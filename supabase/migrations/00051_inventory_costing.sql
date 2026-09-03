-- African Joy Dairy POS
-- 00051: what stock actually cost.
--
-- Stock carried quantities and no cost, which left two holes. Spoilage was
-- counted in litres and never in money, so fifty litres lost never competed
-- for attention against costs visible in shillings. And milk was expensed
-- the day it was bought with no closing-stock adjustment, so a month of
-- heavy buying and light selling read as a bad month even when the milk
-- was still in the tank.
--
-- Weighted average cost, which is the right choice here: milk is fungible,
-- a litre from one farmer is worth what a litre costs on average, and FIFO
-- layers would be precision the business cannot use.
--
-- On the double counting that this design has to avoid: milk goes straight
-- to cost of sales when bought (periodic inventory). Under that method a
-- month-end adjustment moves the value still on hand OUT of cost and into
-- inventory. Spoilage is then already absorbed, because spoilt milk is
-- simply not in closing stock. Posting spoilage as its own cost on top
-- would charge it twice. So spoilage is posted as a RECLASSIFICATION
-- inside cost of sales, moving value from milk purchases to spoilage:
-- total cost is unchanged, but the loss becomes visible on its own line.

alter table public.stock_items
  add column if not exists avg_cost_tzs numeric(14, 4) not null default 0;

comment on column public.stock_items.avg_cost_tzs is
  'Weighted average cost per unit, recalculated on every inbound movement that carries a value.';

-- ---------------------------------------------------------------------------
-- Keeping the average current
-- ---------------------------------------------------------------------------

-- Runs on every movement. An inbound movement carrying an amount blends its
-- cost into the running average; an outbound one leaves the average alone,
-- which is what "weighted average" means: issuing stock does not change what
-- the remainder cost.
--
-- The prior quantity is summed from the movement ledger rather than read
-- from stock_items.on_hand, which deliberately avoids depending on the
-- other trigger at all. on_hand is maintained by an AFTER ROW trigger, and
-- AFTER triggers are queued to the end of the STATEMENT: in a multi-row
-- insert every row would still see the quantity from before the statement
-- began, and each successive row would reset the average instead of
-- blending into it. Summing the ledger is correct either way, because a
-- BEFORE trigger runs after earlier rows of the same statement have landed.
create or replace function public.stock_apply_cost()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prev_qty numeric;
  v_prev_avg numeric;
  v_unit_cost numeric;
begin
  if new.stock_item_id is null or new.qty <= 0 then
    return new;
  end if;
  if new.amount_tzs is null or new.amount_tzs = 0 then
    return new;
  end if;

  select coalesce(sum(m.qty), 0) into v_prev_qty
    from public.movements m where m.stock_item_id = new.stock_item_id;
  select avg_cost_tzs into v_prev_avg
    from public.stock_items where id = new.stock_item_id;

  v_unit_cost := abs(new.amount_tzs) / new.qty;

  -- Nothing held, or a negative balance from a historical oversell: blending
  -- against that would produce a meaningless average, so start fresh at this
  -- movement's cost.
  if coalesce(v_prev_qty, 0) <= 0 then
    update public.stock_items set avg_cost_tzs = round(v_unit_cost, 4)
      where id = new.stock_item_id;
  else
    update public.stock_items
      set avg_cost_tzs = round(
        (v_prev_qty * coalesce(v_prev_avg, 0) + new.qty * v_unit_cost)
        / (v_prev_qty + new.qty), 4)
      where id = new.stock_item_id;
  end if;
  return new;
end $$;

drop trigger if exists movements_apply_cost on public.movements;
create trigger movements_apply_cost before insert on public.movements
  for each row execute function public.stock_apply_cost();

-- Seeds the average from history, so costing is useful from the day it is
-- installed rather than only for milk bought afterwards.
do $$
declare r record;
begin
  for r in
    select m.stock_item_id,
      sum(abs(m.amount_tzs)) as value, sum(m.qty) as qty
    from public.movements m
    where m.stock_item_id is not null and m.qty > 0
      and m.amount_tzs is not null and m.amount_tzs <> 0
    group by m.stock_item_id
  loop
    if r.qty > 0 then
      update public.stock_items set avg_cost_tzs = round(r.value / r.qty, 4)
        where id = r.stock_item_id and avg_cost_tzs = 0;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- What the stock was worth on a given day
-- ---------------------------------------------------------------------------

-- Quantity is replayed from the movement ledger to that date, so a past
-- month is valued on what was actually held then, not on today's shelf.
-- The rate is the current weighted average, which is the accepted way to
-- value under this method and avoids reconstructing a cost history nobody
-- would be able to check.
create or replace function public.stock_value_at(p_date date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    greatest((
      select coalesce(sum(m.qty), 0) from public.movements m
      where m.stock_item_id = si.id and m.date <= p_date
    ), 0) * si.avg_cost_tzs
  ), 0)
  from public.stock_items si
  where si.deleted_at is null;
$$;

create or replace function public.stock_valuation()
returns table (id text, name text, sw_name text, category text, unit text,
               on_hand numeric, avg_cost_tzs numeric, value_tzs numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_cap('stock:read') and not public.has_cap('finance:read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select si.id, si.name, si.sw_name, si.category, si.unit,
      si.on_hand, si.avg_cost_tzs, round(si.on_hand * si.avg_cost_tzs, 2)
    from public.stock_items si
    where si.deleted_at is null and si.active
    order by round(si.on_hand * si.avg_cost_tzs, 2) desc;
end $$;

-- ---------------------------------------------------------------------------
-- Month-end: bring inventory on the balance sheet to what is actually held
-- ---------------------------------------------------------------------------

create or replace function public.gl_post_closing_stock_body(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date;
  v_end date;
  v_target numeric;
  v_current numeric;
  v_delta numeric;
  v_lines jsonb;
begin
  v_month := date_trunc('month', p_month)::date;
  v_end := (v_month + interval '1 month - 1 day')::date;

  v_target := public.stock_value_at(v_end);

  -- What the books currently say inventory is worth at that date.
  select coalesce(sum(l.debit - l.credit), 0) into v_current
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where l.account_code in ('1200', '1210') and e.date <= v_end;

  v_delta := round(v_target - v_current, 2);
  if v_delta = 0 then
    return jsonb_build_object('posted', 0, 'month', v_month, 'closingStock', v_target);
  end if;

  -- Stock grew: value moves out of cost of sales and onto the balance
  -- sheet. Stock shrank: it moves back into cost. Either way cost of sales
  -- ends up reflecting what was actually consumed, not what was bought.
  v_lines := jsonb_build_array(
    jsonb_build_object('account', '1210',
      'debit', case when v_delta > 0 then v_delta else 0 end,
      'credit', case when v_delta < 0 then -v_delta else 0 end,
      'memo', 'Closing stock'),
    jsonb_build_object('account', '5000',
      'debit', case when v_delta < 0 then -v_delta else 0 end,
      'credit', case when v_delta > 0 then v_delta else 0 end,
      'memo', 'Closing stock adjustment')
  );

  if public.gl_write_entry(v_end, 'closing-stock', to_char(v_month, 'YYYY-MM'),
       'Closing stock, ' || to_char(v_month, 'Mon YYYY'), v_lines) is null then
    return jsonb_build_object('posted', 0, 'month', v_month, 'note', 'already-posted');
  end if;

  return jsonb_build_object('posted', 1, 'month', v_month,
                            'closingStock', v_target, 'adjustment', v_delta);
end $$;

create or replace function public.gl_post_closing_stock(p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_cap('finance:write') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.gl_post_closing_stock_body(p_month);
end $$;
revoke all on function public.gl_post_closing_stock_body(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Spoilage, now that it can be valued
-- ---------------------------------------------------------------------------

-- Reclassification, not a new cost: the value moves from milk purchases to
-- spoilage so the loss is visible on its own line, while total cost of
-- sales is unchanged. Charging it as an extra cost would count it twice,
-- because spoilt stock is already absent from closing stock.
create or replace function public.gl_post_spoilage_body(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_posted int := 0; v_lines jsonb; v_amount numeric;
begin
  for r in
    select sp.id::text as id, sp.date, sp.qty, si.name, si.avg_cost_tzs
    from public.spoilages sp
    join public.stock_items si on si.id = sp.stock_item_id
    where sp.date between p_from and p_to
      and not public.gl_posted('spoilage', sp.id::text)
  loop
    v_amount := round(r.qty * r.avg_cost_tzs, 2);
    if v_amount > 0 then
      v_lines := jsonb_build_array(
        jsonb_build_object('account', '5200', 'debit', v_amount, 'credit', 0, 'memo', r.name),
        jsonb_build_object('account', '5000', 'debit', 0, 'credit', v_amount,
                           'memo', 'Reclassified from purchases')
      );
      if public.gl_write_entry(r.date, 'spoilage', r.id,
           'Spoilt ' || r.name, v_lines) is not null then
        v_posted := v_posted + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('posted', v_posted);
end $$;
revoke all on function public.gl_post_spoilage_body(date, date) from public, anon, authenticated;

-- Fold both into the nightly run, so neither depends on somebody
-- remembering at month end.
create or replace function public.gl_post_nightly()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_dep jsonb; v_spoil jsonb; v_close jsonb;
begin
  begin v_result := public.gl_post_range_body(current_date - 7, current_date);
  exception when others then v_result := jsonb_build_object('error', SQLERRM); end;

  begin v_spoil := public.gl_post_spoilage_body(current_date - 7, current_date);
  exception when others then v_spoil := jsonb_build_object('error', SQLERRM); end;

  begin v_dep := public.fa_post_depreciation_body(
           (date_trunc('month', current_date) - interval '1 month')::date);
  exception when others then v_dep := jsonb_build_object('error', SQLERRM); end;

  -- Last month's closing stock, once that month is over.
  begin v_close := public.gl_post_closing_stock_body(
           (date_trunc('month', current_date) - interval '1 month')::date);
  exception when others then v_close := jsonb_build_object('error', SQLERRM); end;

  return jsonb_build_object('posting', v_result, 'spoilage', v_spoil,
                            'depreciation', v_dep, 'closingStock', v_close, 'at', now());
end $$;
revoke all on function public.gl_post_nightly() from public, anon, authenticated;
