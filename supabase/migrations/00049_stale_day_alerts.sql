-- African Joy Dairy POS
-- 00049: chase every unlocked day, not just yesterday.
--
-- The alert ran over generate_series(current_date - 1, current_date - 1),
-- which is a one-day window: a Tuesday that never balanced stopped being
-- mentioned on Thursday. Since a day cannot be locked until it balances,
-- an ignored one stays open forever and nothing keeps asking.
--
-- Also wires up two thresholds that Settings has always saved and nothing
-- has ever read: overdueDays for customer debt, and spoilagePctWarn for
-- the day's wastage. They looked configurable while doing nothing, which
-- is worse than not offering them.

create or replace function public.current_alerts()
returns table (id text, kind text, title text, detail text, severity text, at timestamptz)
language sql stable security definer set search_path = public as $$
  with thresholds as (
    select
      coalesce((alert_thresholds->>'payableWarningDays')::int, 3) as payable_days,
      coalesce((alert_thresholds->>'overdueDays')::int, 14) as overdue_days,
      coalesce((alert_thresholds->>'spoilagePctWarn')::numeric, 5) as spoilage_pct,
      coalesce((alert_thresholds->>'freshLowL')::numeric, 0) as fresh_low
    from public.company_settings limit 1
  )
  -- Low stock, per item, against its own configured threshold.
  select 'low-' || si.id, 'low-stock',
    si.name || ' is low',
    'On hand ' || si.on_hand || ' ' || si.unit, 'warning', now()
  from public.stock_items si
  where si.active and si.deleted_at is null and si.on_hand >= 0
    and si.on_hand <= coalesce(
      case si.alert_threshold_key
        when 'freshLowL' then (select fresh_low from thresholds)
        else null end, si.reorder)
  union all
  -- Negative stock: something was sold or issued that was not there. The
  -- sale guards make this much rarer, but historical rows can still show it.
  select 'neg-' || si.id, 'negative-stock',
    si.name || ' has gone negative',
    'On hand ' || si.on_hand || ' ' || si.unit || ', investigate before locking the day',
    'critical', now()
  from public.stock_items si
  where si.active and si.deleted_at is null and si.on_hand < 0
  union all
  select 'pay-cycle-' || cy.end_date, 'farmer-payable',
    'Farmer payout cycle due ' || cy.end_date,
    (select count(*) || ' farmers, total TZS ' || coalesce(sum(f.current_balance_tzs), 0)
       from public.farmers f where f.current_balance_tzs > 0 and f.deleted_at is null),
    'info', now()
  from public.cycles cy, thresholds th
  where cy.status = 'open' and cy.end_date <= current_date + th.payable_days
  union all
  -- EVERY unlocked day that had activity, oldest first, not just yesterday.
  -- Capped at 60 days so a long-abandoned backlog cannot flood the list;
  -- severity rises with age, because a day left three days is a reminder
  -- and one left a fortnight is a problem.
  select 'unlocked-' || d::date::text, 'day-unbalanced',
    'Day ' || d::date::text || ' not yet locked',
    case
      when current_date - d::date = 1 then 'Production manager to confirm day-close'
      else 'Open for ' || (current_date - d::date) || ' days, the books cannot close past it'
    end,
    case when current_date - d::date >= 7 then 'critical' else 'warning' end,
    now()
  from generate_series(current_date - 60, current_date - 1, interval '1 day') d
  where not exists (select 1 from public.day_locks dl where dl.date = d::date)
    and exists (select 1 from public.movements m where m.date = d::date)
  union all
  -- Customers past the configured overdue window, a threshold that has
  -- been editable in Settings all along without driving anything.
  select 'overdue-' || c.id, 'customer-overdue',
    c.name || ' is overdue',
    'TZS ' || c.outstanding_tzs || ' outstanding, due ' || c.next_due_date,
    'warning', now()
  from public.customers c, thresholds th
  where c.deleted_at is null and c.outstanding_tzs > 0
    and c.next_due_date is not null
    and c.next_due_date < current_date - th.overdue_days
  union all
  -- Yesterday's spoilage as a share of what was collected, against the
  -- configured warning percentage. Silent on days with no intake, since a
  -- percentage of nothing is not a signal.
  select 'spoil-' || d.date::text, 'spoilage-high',
    'Spoilage was ' || round(d.pct, 1) || '% on ' || d.date::text,
    'Above the ' || (select spoilage_pct from thresholds) || '% warning level',
    'warning', now()
  from (
    select m.date,
      sum(case when m.kind = 'spoilt' then abs(m.qty) else 0 end)
        / nullif(sum(case when m.kind = 'collected' then m.qty else 0 end), 0) * 100 as pct
    from public.movements m
    where m.date >= current_date - 7 and m.unit = 'L'
    group by m.date
  ) d, thresholds th
  where d.pct is not null and d.pct > th.spoilage_pct
$$;
