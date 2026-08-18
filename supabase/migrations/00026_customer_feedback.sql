-- African Joy Dairy POS
-- 00026: customer feedback, brought in from the standalone feedback-form
-- app (its own Supabase project, own login) so it's one system instead of
-- two. Public submission goes through one deliberately anon-callable RPC,
-- the same pattern as verify_invoice: security definer, no has_cap check,
-- explicitly granted to anon. Reading results requires view:reports, same
-- capability that already gates the rest of the reporting surface.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  location text,
  rating int not null check (rating between 1 and 5),
  feedback text,
  rating_type text not null check (rating_type in ('loved', 'okay', 'not_good'))
);
create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
create policy feedback_select on public.feedback for select to authenticated
  using (public.has_cap('view:reports'));
-- No insert/update/delete policy for authenticated: submit_feedback() below
-- is the only write path, anon and authenticated alike.

create or replace function public.submit_feedback(
  p_rating int, p_rating_type text, p_name text default null,
  p_location text default null, p_feedback text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'invalid-rating'; end if;
  if p_rating_type not in ('loved', 'okay', 'not_good') then raise exception 'invalid-rating-type'; end if;
  insert into public.feedback (name, location, rating, feedback, rating_type)
  values (
    nullif(trim(p_name), ''), nullif(trim(p_location), ''), p_rating,
    nullif(trim(p_feedback), ''), p_rating_type
  );
end $$;

grant execute on function public.submit_feedback(int, text, text, text, text) to anon, authenticated;

create view public.feedback_stats
  with (security_invoker = on) as
  select
    count(*) as total_reviews,
    round(avg(rating)::numeric, 2) as average_rating,
    round((count(*) filter (where rating = 5)::numeric / nullif(count(*), 0) * 100), 1) as five_star_pct,
    count(*) filter (where created_at >= now() - interval '7 days') as last_7_days,
    count(*) filter (
      where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'
    ) as prior_7_days
  from public.feedback;

create view public.feedback_rating_distribution
  with (security_invoker = on) as
  select rating, count(*) as count
  from public.feedback
  group by rating
  order by rating desc;

create view public.feedback_monthly
  with (security_invoker = on) as
  select
    date_trunc('month', created_at)::date as month,
    round(avg(rating)::numeric, 2) as avg_rating,
    count(*) as review_count
  from public.feedback
  group by 1
  order by 1 desc
  limit 12;
