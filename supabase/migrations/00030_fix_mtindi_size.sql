-- African Joy Dairy POS
-- 00030: Mtindi's small size is 500ml, not 1.5L, fixes the product added in
-- 00029. Unit switches to pcs to match how the other 500ml products
-- (Yoghurt flavours) are already sold, packaged units not bulk litres.
-- Prices were still at the seeded 0 TZS placeholder, nothing real to lose.

update public.products
  set name = 'Mtindi 500ml', sw_name = 'Mtindi 500ml', unit = 'pcs'
  where id = 'p-39bdcb2d';
