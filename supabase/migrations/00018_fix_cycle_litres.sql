-- African Joy Dairy POS
-- 00018: fixes "litres this cycle" reading 0 for every farmer despite
-- collections being recorded correctly (the monthly view already showed
-- them fine, calendar months don't have this problem).
--
-- farmer_cycle_stats only counted a collection if its date fell BETWEEN
-- the open cycle's start_date and end_date. A payout cycle's end_date is
-- only ever advanced by initiate_payouts(), which runs when someone
-- actually completes a payout run, not on a schedule. If no payout has
-- happened since the cycle was opened, its end_date sits fixed in the
-- past; every collection recorded after that date falls outside the
-- window and silently drops out of the sum, for every farmer at once,
-- with no error anywhere to signal it.
--
-- The fix: a cycle marked 'open' or 'paying' is, by definition, still
-- accruing, regardless of whether today happens to be past its nominal
-- end_date, that date is a target for when a payout should happen, not a
-- hard cutoff on the ledger. Counting from start_date onward with no
-- upper bound reflects that.

create or replace view public.farmer_cycle_stats
  with (security_invoker = on) as
  select f.id as farmer_id,
    coalesce((
      select sum(c.litres) from public.collections c
      join public.cycles cy on cy.status in ('open', 'paying')
      where c.farmer_id = f.id and c.date >= cy.start_date
    ), 0) as litres_this_cycle
  from public.farmers f;
