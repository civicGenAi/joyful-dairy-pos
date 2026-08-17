/**
 * Clears the demo/transactional data so real entries can begin, while KEEPING:
 *   - users (profiles + auth accounts)
 *   - company settings
 *   - locations
 *   - product catalogue + current prices
 *   - stock item definitions (quantities reset to 0)
 *
 * Wipes: collections, transfers, batches, spoilages, sales, deposits,
 * payouts, farmer balance adjustments, expenses, movements, day locks,
 * audit log, farmers, customers, and price history older than the current
 * price. Opens a fresh 15-day payout cycle starting today.
 *
 * farmer_adjustments must be cleared before farmers: since 00010_soft_delete
 * tightened farmer_adjustments.farmer_id to ON DELETE RESTRICT (it used to
 * silently cascade, which was itself the bug that migration fixed), leaving
 * any adjustment rows behind would make the farmers wipe below fail outright.
 *
 * Usage:  bun run db:clear -- --yes
 * (Needs SUPABASE_SERVICE_ROLE_KEY in .env.local, same as db:seed.)
 */
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--yes")) {
  console.error(
    "This permanently deletes operational data. Re-run with: bun run db:clear -- --yes",
  );
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (put them in .env / .env.local).",
  );
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function wipe(table: string, idColumn = "id") {
  const { error } = await db.from(table).delete().not(idColumn, "is", null);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  cleared ${table}`);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const cycleEnd = new Date(today);
cycleEnd.setDate(cycleEnd.getDate() + 14);

console.log("Clearing operational data...");
await wipe("audit_log");
await wipe("sale_lines");
await wipe("sales");
await wipe("deposits");
await wipe("payouts");
await wipe("cycles");
await wipe("spoilages");
await wipe("batches");
await wipe("transfers");
await wipe("collections");
await wipe("farmer_adjustments");
await wipe("movements");
await wipe("day_locks", "date");
await wipe("expenses");
await wipe("customers");
await wipe("farmers");

console.log("Resetting stock quantities to zero...");
{
  const { error } = await db
    .from("stock_items")
    .update({ on_hand: 0, last_movement_at: null })
    .not("id", "is", null);
  if (error) throw new Error(`stock_items: ${error.message}`);
}

console.log("Opening a fresh 15-day payout cycle...");
{
  const { error } = await db
    .from("cycles")
    .insert({ start_date: iso(today), end_date: iso(cycleEnd), status: "open" });
  if (error) throw new Error(`cycles: ${error.message}`);
}

console.log(
  `Done. The system is empty and ready for real entries (cycle ${iso(today)} to ${iso(cycleEnd)}).`,
);
console.log("Kept: users, company settings, locations, products, prices, stock item definitions.");
