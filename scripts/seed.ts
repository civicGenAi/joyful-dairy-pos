/**
 * Seeds the Supabase project with the demo dataset, shifted so the "demo day"
 * is the real current date. Idempotent: wipes data tables first, upserts the
 * nine demo auth accounts (password joy1234).
 *
 * Usage:  SUPABASE_SERVICE_ROLE_KEY=... bun scripts/seed.ts
 * (bun auto-loads .env and .env.local; put the service key in .env.local.)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (put them in .env / .env.local).",
  );
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return iso(d);
};

async function insert(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

// ---------------------------------------------------------------------------
// 1. Auth users + profiles
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  {
    name: "Joyce Mollel",
    email: "admin@africanjoy.co.tz",
    phone: "+255 754 100 001",
    roles: ["admin"],
    color: "#1E7C3F",
  },
  {
    name: "Asha Mwakasege",
    email: "finance@africanjoy.co.tz",
    phone: "+255 754 100 002",
    roles: ["finance"],
    color: "#2F9E44",
  },
  {
    name: "Daudi Massawe",
    email: "production@africanjoy.co.tz",
    phone: "+255 754 100 003",
    roles: ["production"],
    color: "#6FBF59",
  },
  {
    name: "Neema Kileo",
    email: "sales@africanjoy.co.tz",
    phone: "+255 754 100 004",
    roles: ["sales"],
    color: "#8CC63F",
  },
  {
    name: "Baraka Laizer",
    email: "route@africanjoy.co.tz",
    phone: "+255 754 100 005",
    roles: ["route"],
    color: "#E11B22",
  },
  {
    name: "Mama Esther",
    email: "store@africanjoy.co.tz",
    phone: "+255 754 100 006",
    roles: ["store"],
    color: "#E5A100",
  },
  {
    name: "Glory Mushi",
    email: "viewer@africanjoy.co.tz",
    phone: "+255 754 100 007",
    roles: ["viewer"],
    color: "#1D9E75",
  },
  {
    name: "Peter Sanare",
    email: "peter@africanjoy.co.tz",
    phone: "+255 754 100 008",
    roles: ["sales", "store"],
    color: "#14532D",
  },
  {
    name: "Lightness Kivuyo",
    email: "lightness@africanjoy.co.tz",
    phone: "+255 754 100 009",
    roles: ["finance", "viewer"],
    color: "#0f5d44",
  },
];

async function ensureAuthUser(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "joy1234",
    email_confirm: true,
  });
  if (!error) return data.user.id;
  // Already exists: find it.
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) throw new Error(`could not create or find auth user ${email}: ${error.message}`);
  return existing.id;
}

console.log("Wiping data tables...");
const WIPE_ORDER = [
  "audit_log",
  "sale_lines",
  "sales",
  "deposits",
  "payouts",
  "cycles",
  "spoilages",
  "batches",
  "transfers",
  "collections",
  "movements",
  "day_locks",
  "expenses",
  "price_list",
  "stock_items",
  "customers",
  "farmers",
  "products",
  "locations",
  "company_settings",
  "profiles",
];
for (const table of WIPE_ORDER) {
  const { error } = await db.from(table).delete().gte("ctid", "(0,0)").select("*").limit(0);
  if (error) {
    // ctid trick unsupported through PostgREST: fall back to a broad filter.
    const { error: e2 } = await db.from(table).delete().not("id", "is", null);
    if (e2 && !e2.message.includes("does not exist")) {
      const { error: e3 } = await db.from(table).delete().not("date", "is", null);
      if (e3) throw new Error(`wipe ${table}: ${e2.message}`);
    }
  }
}

console.log("Creating auth users + profiles...");
const profiles: Record<string, string> = {}; // email -> profile id
for (const u of DEMO_USERS) {
  const authId = await ensureAuthUser(u.email);
  const { data, error } = await db
    .from("profiles")
    .insert({
      auth_user_id: authId,
      name: u.name,
      email: u.email,
      phone: u.phone,
      roles: u.roles,
      active: true,
      avatar_color: u.color,
    })
    .select("id")
    .single();
  if (error) throw new Error(`profiles: ${error.message}`);
  profiles[u.email] = data.id;
}
console.log(`  profiles: ${DEMO_USERS.length} rows`);
const admin = profiles["admin@africanjoy.co.tz"];
const financeUser = profiles["finance@africanjoy.co.tz"];
const productionUser = profiles["production@africanjoy.co.tz"];
const salesUser = profiles["sales@africanjoy.co.tz"];
const routeUser = profiles["route@africanjoy.co.tz"];

// ---------------------------------------------------------------------------
// 2. Company, locations, products, prices
// ---------------------------------------------------------------------------

await insert("company_settings", [
  {
    id: 1,
    name: "African Joy Dairy",
    city: "Arusha, Tanzania",
    tagline: "Premium dairy, empowering women farmers",
    footer: "Asante kwa kuchagua African Joy, thank you for choosing African Joy.",
    phone: "+255 754 100 000",
    email: "info@africanjoy.co.tz",
    vrn: "VRN-40-123456-A",
    tin: "TIN-123-456-789",
    alert_thresholds: {
      overdueDays: 14,
      payableWarningDays: 3,
      spoilagePctWarn: 5,
      lowStockUseReorder: true,
      dayLockBy: "21:00",
    },
    report_schedule: {
      daily: { whatsapp: true, email: true, sms: false },
      weekly: { whatsapp: true, email: true, sms: false },
      monthly: { whatsapp: false, email: true, sms: false },
    },
  },
]);

await insert("locations", [
  {
    id: "loc-field-a",
    name: "Point A, Olasiti",
    sw_name: "Pointi A, Olasiti",
    kind: "collection-point",
    note: "Field collection, mornings + evenings",
    active: true,
  },
  {
    id: "loc-main",
    name: "Main plant, Arusha",
    sw_name: "Kiwandani, Arusha",
    kind: "plant",
    note: "Headquarters and processing",
    active: true,
  },
  {
    id: "loc-van1",
    name: "Route van #1",
    sw_name: "Gari la njia #1",
    kind: "van",
    note: "Driver: Baraka Laizer",
    active: true,
  },
  {
    id: "loc-van2",
    name: "Route van #2",
    sw_name: "Gari la njia #2",
    kind: "van",
    note: "Shared with sales team",
    active: true,
  },
  {
    id: "loc-store",
    name: "Consumables store",
    sw_name: "Ghala la vifaa",
    kind: "store",
    note: "Packaging and raw materials",
    active: true,
  },
]);

const PRODUCTS = [
  { id: "p-fresh", name: "Fresh milk", sw_name: "Maziwa Fresh", category: "fresh-milk", unit: "L" },
  {
    id: "p-mtindi",
    name: "Cultured milk (Mtindi)",
    sw_name: "Mtindi",
    category: "cultured",
    unit: "L",
  },
  {
    id: "p-yog-straw",
    name: "Yoghurt Strawberry 500ml",
    sw_name: "Yogati Strawberry",
    category: "yoghurt",
    unit: "pcs",
  },
  {
    id: "p-yog-van",
    name: "Yoghurt Vanilla 500ml",
    sw_name: "Yogati Vanilla",
    category: "yoghurt",
    unit: "pcs",
  },
  {
    id: "p-yog-greek",
    name: "Yoghurt Greek 500ml",
    sw_name: "Yogati Greek",
    category: "yoghurt",
    unit: "pcs",
  },
  {
    id: "p-yog-nat",
    name: "Yoghurt Natural 500ml",
    sw_name: "Yogati Asili",
    category: "yoghurt",
    unit: "pcs",
  },
  { id: "p-cream", name: "Cream", sw_name: "Krimu", category: "cream", unit: "L" },
  {
    id: "p-mozz",
    name: "Mozzarella",
    sw_name: "Mozzarella",
    category: "cheese",
    unit: "kg",
    conversion_note: "244 L ≈ 20 kg",
  },
  {
    id: "p-gouda",
    name: "Gouda",
    sw_name: "Gouda",
    category: "cheese",
    unit: "kg",
    conversion_note: "Aged 30 days",
  },
  {
    id: "p-hall",
    name: "Halloumi",
    sw_name: "Halloumi",
    category: "cheese",
    unit: "kg",
    conversion_note: "75 L ≈ 6.35 kg",
  },
  { id: "p-ched", name: "Cheddar", sw_name: "Cheddar", category: "cheese", unit: "kg" },
  { id: "p-pan", name: "Paneer", sw_name: "Paneer", category: "cheese", unit: "kg" },
  { id: "p-feta", name: "Feta", sw_name: "Feta", category: "cheese", unit: "kg" },
  { id: "p-ghee", name: "Ghee", sw_name: "Samli", category: "ghee", unit: "L" },
  { id: "p-butter", name: "Butter 250g", sw_name: "Siagi 250g", category: "butter", unit: "pcs" },
];
await insert(
  "products",
  PRODUCTS.map((p) => ({ ...p, active: true })),
);

const PRICE_MATRIX: Record<string, Record<"own" | "bottle" | "bulk", number>> = {
  "p-fresh": { own: 1500, bottle: 1700, bulk: 1400 },
  "p-mtindi": { own: 1700, bottle: 2000, bulk: 1600 },
  "p-yog-straw": { own: 2300, bottle: 2500, bulk: 2250 },
  "p-yog-van": { own: 2300, bottle: 2500, bulk: 2250 },
  "p-yog-greek": { own: 2800, bottle: 3000, bulk: 2700 },
  "p-yog-nat": { own: 2200, bottle: 2400, bulk: 2150 },
  "p-cream": { own: 4000, bottle: 4500, bulk: 3800 },
  "p-mozz": { own: 14000, bottle: 14000, bulk: 13500 },
  "p-gouda": { own: 17000, bottle: 17000, bulk: 16500 },
  "p-hall": { own: 15000, bottle: 15000, bulk: 14500 },
  "p-ched": { own: 16000, bottle: 16000, bulk: 15500 },
  "p-pan": { own: 13000, bottle: 13000, bulk: 12500 },
  "p-feta": { own: 15500, bottle: 15500, bulk: 15000 },
  "p-ghee": { own: 18000, bottle: 19000, bulk: 17500 },
  "p-butter": { own: 6000, bottle: 6500, bulk: 5800 },
};
await insert(
  "price_list",
  Object.entries(PRICE_MATRIX).flatMap(([productId, tiers]) =>
    (Object.entries(tiers) as ["own" | "bottle" | "bulk", number][]).map(([tier, value]) => ({
      product_id: productId,
      tier,
      value,
      effective_from: day(-60),
      created_by: admin,
    })),
  ),
);
// One price-history entry so the Products price-history tab has something real.
await insert("price_list", [
  { product_id: "p-fresh", tier: "own", value: 1400, effective_from: day(-120), created_by: admin },
]);

// ---------------------------------------------------------------------------
// 3. Farmers + customers
// ---------------------------------------------------------------------------

const FARMER_NAMES = [
  "Godfrey Mosses Nassary",
  "John Frison Mollel",
  "Idda Amani Kirenga",
  "Mama Lightness",
  "Nathani Olesirikan",
  "Simon Makundi",
  "Gilliard Daniel",
  "Emson Saruni Laizer",
  "Viki Rabson Kivuyo",
  "Amanulas Ackson Kibora",
  "Glory Fanuel Lukumay",
  "Maria Mathayo Sanare",
  "Mama Joel",
  "Goodluck Msafiri Mkubwa",
  "Jackline Ibrahim Kivuyo",
];
const VILLAGES = ["Olasiti", "Sakina", "Kisongo", "Ngaramtoni", "Tengeru", "Usa River"];

const farmers = FARMER_NAMES.map((name, i) => {
  const daily = 8 + ((i * 17) % 110); // litres per day
  const status = i % 5 === 0 ? "delayed" : i % 3 === 0 ? "due" : i % 7 === 0 ? "paid" : "active";
  return {
    id: `f${i + 1}`,
    name,
    phone: `+255 7${20 + i} 4${(i * 7) % 100}${100 + i}`,
    village: VILLAGES[i % VILLAGES.length],
    rate_per_l: 1200,
    daily,
    status,
    last_payment_tzs: i % 2 === 0 ? 540000 + i * 5000 : 320000 + i * 4000,
    last_payment_date: day(-13 - (i % 10)),
  };
});
await insert(
  "farmers",
  farmers.map((f) => ({
    id: f.id,
    name: f.name,
    phone: f.phone,
    village: f.village,
    rate_per_l: f.rate_per_l,
    current_balance_tzs: 0, // accrued by collections below
    last_payment_tzs: f.last_payment_tzs,
    last_payment_date: f.last_payment_date,
    status: f.status,
  })),
);

const CUSTOMER_DEFS: { name: string; type: "cash" | "credit" | "monthly" }[] = [
  { name: "Mamis Bistro", type: "monthly" },
  { name: "Valonia Apartment", type: "monthly" },
  { name: "Mama Esther", type: "credit" },
  { name: "Mama Mtenga", type: "credit" },
  { name: "Laura Massawe", type: "cash" },
  { name: "Sidhu Restaurant", type: "monthly" },
  { name: "Mama Matunga", type: "credit" },
  { name: "Vicki Stores", type: "cash" },
  { name: "Madam Joy", type: "credit" },
  { name: "Kivuyo Family", type: "cash" },
  { name: "Nyumbani Cafe", type: "monthly" },
  { name: "Kiwandani Grocers", type: "credit" },
  { name: "Jovinary Hotel", type: "monthly" },
  { name: "Nelly Boutique", type: "cash" },
  { name: "CSR Hotel", type: "monthly" },
  { name: "Walter Sanare", type: "credit" },
  { name: "Rashda Suites", type: "monthly" },
];
const customers = CUSTOMER_DEFS.map((c, i) => ({
  id: `c${i + 1}`,
  name: c.name,
  phone: `+255 78${i} ${100 + i}${i}${i} ${200 + i}`,
  type: c.type,
  overdue: i % 4 === 0 && c.type !== "cash",
  i,
}));
await insert(
  "customers",
  customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    type: c.type,
    outstanding_tzs: 0, // accrued by the seeded credit sales below
    last_activity: day(-(c.i % 20)),
    status: c.overdue ? "overdue" : "ok",
  })),
);

// ---------------------------------------------------------------------------
// 4. Stock items (finished + consumables + raw)
// ---------------------------------------------------------------------------

const STOCK_ITEMS = [
  {
    id: "s-fresh",
    product_id: "p-fresh",
    name: "Fresh milk",
    category: "finished",
    unit: "L",
    on_hand: 240,
    reorder: 100,
  },
  {
    id: "s-mtindi",
    product_id: "p-mtindi",
    name: "Mtindi",
    category: "finished",
    unit: "L",
    on_hand: 180,
    reorder: 80,
  },
  {
    id: "s-yog-straw",
    product_id: "p-yog-straw",
    name: "Yoghurt Strawberry 500ml",
    category: "finished",
    unit: "pcs",
    on_hand: 36,
    reorder: 60,
  },
  {
    id: "s-yog-van",
    product_id: "p-yog-van",
    name: "Yoghurt Vanilla 500ml",
    category: "finished",
    unit: "pcs",
    on_hand: 84,
    reorder: 60,
  },
  {
    id: "s-cream",
    product_id: "p-cream",
    name: "Cream",
    category: "finished",
    unit: "L",
    on_hand: 18,
    reorder: 25,
  },
  {
    id: "s-mozz",
    product_id: "p-mozz",
    name: "Mozzarella",
    category: "finished",
    unit: "kg",
    on_hand: 12,
    reorder: 8,
  },
  {
    id: "s-hall",
    product_id: "p-hall",
    name: "Halloumi",
    category: "finished",
    unit: "kg",
    on_hand: 4.2,
    reorder: 5,
  },
  {
    id: "s-pan",
    product_id: "p-pan",
    name: "Paneer",
    category: "finished",
    unit: "kg",
    on_hand: 7,
    reorder: 5,
  },
  {
    id: "s-ghee",
    product_id: "p-ghee",
    name: "Ghee",
    category: "finished",
    unit: "L",
    on_hand: 22,
    reorder: 15,
  },
  {
    id: "s-butter",
    product_id: "p-butter",
    name: "Butter 250g",
    category: "finished",
    unit: "pcs",
    on_hand: 0,
    reorder: 20,
  },
  {
    id: "c-mad5",
    name: "Madumu 5L",
    sw_name: "Madumu 5L",
    category: "consumable",
    unit: "pcs",
    on_hand: 26,
    reorder: 20,
  },
  {
    id: "c-mad3",
    name: "Madumu 3L",
    sw_name: "Madumu 3L",
    category: "consumable",
    unit: "pcs",
    on_hand: 14,
    reorder: 20,
  },
  {
    id: "c-vik-n",
    name: "Vikopo vya nusu",
    sw_name: "Vikopo nusu",
    category: "consumable",
    unit: "pcs",
    on_hand: 320,
    reorder: 200,
  },
  {
    id: "c-vik-r",
    name: "Vikopo vya robo",
    sw_name: "Vikopo robo",
    category: "consumable",
    unit: "pcs",
    on_hand: 140,
    reorder: 200,
  },
  {
    id: "c-vik-150",
    name: "Vikopo vya 150ml",
    category: "consumable",
    unit: "pcs",
    on_hand: 480,
    reorder: 300,
  },
  {
    id: "c-vik-100",
    name: "Vikopo vya 100ml",
    category: "consumable",
    unit: "pcs",
    on_hand: 90,
    reorder: 150,
  },
  {
    id: "c-trays",
    name: "Trays",
    sw_name: "Trei",
    category: "consumable",
    unit: "pcs",
    on_hand: 18,
    reorder: 10,
  },
  {
    id: "c-box",
    name: "Box ndogo",
    sw_name: "Box ndogo",
    category: "consumable",
    unit: "pcs",
    on_hand: 6,
    reorder: 12,
  },
  {
    id: "raw-milk",
    name: "Raw milk",
    sw_name: "Maziwa ghafi",
    category: "raw",
    unit: "L",
    on_hand: 284,
    reorder: 100,
  },
  {
    id: "raw-cream",
    name: "Raw cream",
    sw_name: "Krimu ghafi",
    category: "raw",
    unit: "L",
    on_hand: 40,
    reorder: 10,
  },
  {
    id: "raw-curd",
    name: "Curd",
    sw_name: "Curd",
    category: "raw",
    unit: "kg",
    on_hand: 25,
    reorder: 5,
  },
];
await insert(
  "stock_items",
  STOCK_ITEMS.map((s) => ({ ...s, last_movement_at: new Date().toISOString() })),
);

// ---------------------------------------------------------------------------
// 5. Payout cycles + collections (current cycle, every farmer, every day)
//    The open cycle started 12 days ago and pays out in 3 days.
// ---------------------------------------------------------------------------

const { data: cycleRows, error: cycleErr } = await db
  .from("cycles")
  .insert([
    { start_date: day(-27), end_date: day(-13), status: "closed" },
    { start_date: day(-12), end_date: day(2), status: "open" },
  ])
  .select("id, status");
if (cycleErr) throw new Error(`cycles: ${cycleErr.message}`);
console.log(`  cycles: ${cycleRows.length} rows`);

const collections: Record<string, unknown>[] = [];
const collectedByDay: Record<string, number> = {};
for (let offset = -12; offset <= 0; offset++) {
  const date = day(offset);
  collectedByDay[date] = 0;
  farmers.forEach((f, i) => {
    const morning = Math.round(f.daily * 0.6);
    const evening = f.daily - morning;
    collections.push(
      {
        farmer_id: f.id,
        date,
        session: "morning",
        litres: morning,
        location_id: i % 2 === 0 ? "loc-field-a" : "loc-main",
        rate_per_l: f.rate_per_l,
        recorded_by: admin,
      },
      {
        farmer_id: f.id,
        date,
        session: "evening",
        litres: evening,
        location_id: i % 3 === 0 ? "loc-field-a" : "loc-main",
        rate_per_l: f.rate_per_l,
        recorded_by: admin,
      },
    );
    collectedByDay[date] += f.daily;
  });
}
await insert("collections", collections);

// Accrue farmer balances from the open cycle's collections (paid farmers owe less).
for (const f of farmers) {
  const accrued = f.daily * 13 * f.rate_per_l;
  const balance =
    f.status === "paid"
      ? 0
      : f.status === "due" || f.status === "delayed"
        ? accrued
        : Math.round(accrued * 0.4);
  const { error } = await db
    .from("farmers")
    .update({ current_balance_tzs: balance })
    .eq("id", f.id);
  if (error) throw new Error(`farmer balance: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 6. Movement ledger history (charts + reconciliation read from this)
//    stock_item_id stays null on historic rows so seeded on_hand values are
//    not double-counted; live writes via RPCs do carry stock_item_id.
// ---------------------------------------------------------------------------

const movements: Record<string, unknown>[] = [];
for (let offset = -29; offset <= -1; offset++) {
  const date = day(offset);
  const wave = 820 + Math.sin(offset / 3) * 80 + (Math.abs(offset) % 5) * 6;
  const collected = collectedByDay[date] ?? Math.round(wave);
  const soldCash = Math.round(collected * 0.45);
  const soldCredit = Math.round(collected * 0.17);
  const separated = Math.round(collected * 0.3);
  const spoilt = 8 + (Math.abs(offset) % 6) * 2;
  const returned = 6 + (Math.abs(offset) % 4);
  movements.push(
    { date, kind: "collected", product_id: "p-fresh", qty: collected, unit: "L", actor: admin },
    { date, kind: "sold-cash", product_id: "p-fresh", qty: -soldCash, unit: "L", actor: salesUser },
    {
      date,
      kind: "sold-credit",
      product_id: "p-fresh",
      qty: -soldCredit,
      unit: "L",
      actor: salesUser,
    },
    {
      date,
      kind: "separated",
      product_id: "p-fresh",
      qty: -separated,
      unit: "L",
      actor: productionUser,
    },
    { date, kind: "spoilt", product_id: "p-fresh", qty: -spoilt, unit: "L", actor: productionUser },
    { date, kind: "returned", product_id: "p-fresh", qty: -returned, unit: "L", actor: routeUser },
    {
      date,
      kind: "produced",
      product_id: "p-mtindi",
      qty: Math.round(separated * 0.7),
      unit: "L",
      actor: productionUser,
    },
    {
      date,
      kind: "sold-cash",
      product_id: "p-mtindi",
      qty: -Math.round(separated * 0.5),
      unit: "L",
      actor: salesUser,
    },
  );
}

// Today: a fully balanced day mirroring the old RECON_TODAY pattern.
const todayCollected = collectedByDay[day(0)];
const todayPlan = [
  // [product, soldCash, soldCredit, separated, spoilt, returned]
  {
    pid: "p-fresh",
    collected: todayCollected,
    produced: 0,
    soldCash: 380,
    soldCredit: 120,
    separated: 320,
    spoilt: 12,
    returned: 14,
  },
  {
    pid: "p-mtindi",
    collected: 0,
    produced: 220,
    soldCash: 110,
    soldCredit: 80,
    separated: 0,
    spoilt: 4,
    returned: 6,
  },
  {
    pid: "p-cream",
    collected: 0,
    produced: 32,
    soldCash: 12,
    soldCredit: 5,
    separated: 0,
    spoilt: 0,
    returned: 0,
  },
  {
    pid: "p-mozz",
    collected: 0,
    produced: 20,
    soldCash: 8,
    soldCredit: 2,
    separated: 0,
    spoilt: 0,
    returned: 0,
  },
  {
    pid: "p-hall",
    collected: 0,
    produced: 6.35,
    soldCash: 2,
    soldCredit: 1,
    separated: 0,
    spoilt: 0,
    returned: 0,
  },
  {
    pid: "p-ghee",
    collected: 0,
    produced: 6,
    soldCash: 1,
    soldCredit: 0,
    separated: 0,
    spoilt: 0,
    returned: 0,
  },
];
const unitOf = (pid: string) => PRODUCTS.find((p) => p.id === pid)!.unit;
for (const r of todayPlan) {
  const u = unitOf(r.pid);
  if (r.collected)
    movements.push({
      date: day(0),
      kind: "collected",
      product_id: r.pid,
      qty: r.collected,
      unit: u,
      actor: admin,
    });
  if (r.produced)
    movements.push({
      date: day(0),
      kind: "produced",
      product_id: r.pid,
      qty: r.produced,
      unit: u,
      actor: productionUser,
    });
  if (r.separated)
    movements.push({
      date: day(0),
      kind: "separated",
      product_id: r.pid,
      qty: -r.separated,
      unit: u,
      actor: productionUser,
    });
  if (r.soldCash)
    movements.push({
      date: day(0),
      kind: "sold-cash",
      product_id: r.pid,
      qty: -r.soldCash,
      unit: u,
      actor: salesUser,
    });
  if (r.soldCredit)
    movements.push({
      date: day(0),
      kind: "sold-credit",
      product_id: r.pid,
      qty: -r.soldCredit,
      unit: u,
      actor: salesUser,
    });
  if (r.spoilt)
    movements.push({
      date: day(0),
      kind: "spoilt",
      product_id: r.pid,
      qty: -r.spoilt,
      unit: u,
      actor: productionUser,
    });
  if (r.returned)
    movements.push({
      date: day(0),
      kind: "returned",
      product_id: r.pid,
      qty: -r.returned,
      unit: u,
      actor: routeUser,
    });
}
await insert("movements", movements);

// ---------------------------------------------------------------------------
// 7. Day locks: two days ago confirmed, yesterday locked awaiting finance.
// ---------------------------------------------------------------------------

const lockRows = (closings: Record<string, number>) =>
  todayPlan.map((r) => ({
    product_id: r.pid,
    product: PRODUCTS.find((p) => p.id === r.pid)!.name,
    unit: unitOf(r.pid),
    opening: 0,
    collected: 0,
    produced: 0,
    soldCash: 0,
    soldCredit: 0,
    separated: 0,
    spoilt: 0,
    returned: 0,
    closing: closings[r.pid] ?? 0,
  }));
const YESTERDAY_CLOSINGS = {
  "p-fresh": 60,
  "p-mtindi": 40,
  "p-cream": 6,
  "p-mozz": 2,
  "p-hall": 1,
  "p-ghee": 18,
};
await insert("day_locks", [
  {
    date: day(-2),
    rows: lockRows({
      "p-fresh": 55,
      "p-mtindi": 35,
      "p-cream": 8,
      "p-mozz": 3,
      "p-hall": 2,
      "p-ghee": 17,
    }),
    locked_by: productionUser,
    locked_at: new Date(Date.now() - 2 * 86400e3).toISOString(),
    confirmed_by: financeUser,
    confirmed_at: new Date(Date.now() - 2 * 86400e3 + 3600e3).toISOString(),
  },
  {
    date: day(-1),
    rows: lockRows(YESTERDAY_CLOSINGS),
    locked_by: productionUser,
    locked_at: new Date(Date.now() - 86400e3).toISOString(),
  },
]);

// ---------------------------------------------------------------------------
// 8. Production batches (today + yield history)
// ---------------------------------------------------------------------------

const batches: Record<string, unknown>[] = [
  {
    date: day(0),
    product_id: "p-mtindi",
    input_litres: 230,
    output_qty: 220,
    unit: "L",
    yield_pct: 95.7,
    wastage: 10,
    recorded_by: productionUser,
  },
  {
    date: day(0),
    product_id: "p-cream",
    input_litres: 40,
    output_qty: 32,
    unit: "L",
    yield_pct: 80,
    wastage: 8,
    recorded_by: productionUser,
  },
  {
    date: day(0),
    product_id: "p-mozz",
    input_litres: 50,
    output_qty: 20,
    unit: "kg",
    yield_pct: 40,
    wastage: 0,
    note: "244 L ≈ 20 kg run",
    recorded_by: productionUser,
  },
  {
    date: day(0),
    product_id: "p-hall",
    input_litres: 0,
    output_qty: 6.35,
    unit: "kg",
    wastage: 0,
    note: "From curd",
    recorded_by: productionUser,
  },
  {
    date: day(0),
    product_id: "p-ghee",
    input_litres: 0,
    output_qty: 6,
    unit: "L",
    wastage: 0,
    note: "From cream",
    recorded_by: productionUser,
  },
];
for (let offset = -7; offset <= -1; offset++) {
  const y = [81, 83, 80, 85, 84, 86, 82][offset + 7];
  batches.push({
    date: day(offset),
    product_id: "p-mtindi",
    input_litres: 240,
    output_qty: Math.round(240 * (y / 100)),
    unit: "L",
    yield_pct: y,
    wastage: 240 - Math.round(240 * (y / 100)),
    recorded_by: productionUser,
  });
}
await insert("batches", batches);
await insert("spoilages", [
  {
    date: day(0),
    stock_item_id: "s-fresh",
    qty: 12,
    reason: "Sour at intake",
    recorded_by: productionUser,
  },
  {
    date: day(0),
    stock_item_id: "s-mtindi",
    qty: 4,
    reason: "Packaging leak",
    recorded_by: productionUser,
  },
]);

// ---------------------------------------------------------------------------
// 9. Sales history (statements, top customers, channel split) + deposits
// ---------------------------------------------------------------------------

const productPool = [
  "p-fresh",
  "p-mtindi",
  "p-yog-straw",
  "p-yog-van",
  "p-cream",
  "p-mozz",
  "p-ghee",
  "p-butter",
];
let saleSeq = 1;
const sales: Record<string, unknown>[] = [];
const saleLines: Record<string, unknown>[] = [];
const outstanding: Record<string, number> = {};

for (const c of customers) {
  const isMonthly = c.type === "monthly";
  const count = isMonthly ? 18 : 6;
  for (let k = 0; k < count; k++) {
    const pid = productPool[(k + c.i) % productPool.length];
    const tier = isMonthly ? "bulk" : "own";
    const price = PRICE_MATRIX[pid][tier as "bulk" | "own"];
    const qty = pid === "p-mozz" || pid === "p-ghee" ? 2 + (k % 3) : 4 + (k % 6);
    const date = isMonthly ? day((-(k * 30) % 28) - 1) : day((-(5 + k * 4) % 27) - 1);
    const payment = c.type === "cash" ? (k % 3 === 0 ? "mpesa" : "cash") : "credit";
    const channel = c.i % 3 === 0 ? "route" : "counter";
    const id = `RCT-${1000 + saleSeq++}`;
    const amount = qty * price;
    sales.push({
      id,
      date,
      at: `${date}T10:30:00Z`,
      channel,
      customer_id: c.id,
      customer_name: c.name,
      payment,
      tier,
      total_tzs: amount,
      location_id: channel === "route" ? "loc-van1" : "loc-main",
      sold_by: channel === "route" ? routeUser : salesUser,
    });
    saleLines.push({
      sale_id: id,
      product_id: pid,
      qty,
      unit: unitOf(pid),
      unit_price: price,
      amount_tzs: amount,
    });
    if (payment === "credit") outstanding[c.id] = (outstanding[c.id] ?? 0) + amount;
  }
}
await insert("sales", sales);
await insert("sale_lines", saleLines);

const deposits: Record<string, unknown>[] = [];
let depSeq = 1;
for (const c of customers) {
  if (c.type === "monthly") {
    const d1 = 150000 + c.i * 10000;
    const d2 = 200000 + c.i * 8000;
    deposits.push(
      {
        id: `DEP-${1000 + depSeq++}`,
        date: day(-18),
        source: "customer",
        customer_id: c.id,
        method: "bank",
        amount_tzs: d1,
        ref: `RCT-${1000 + c.i}A`,
        recorded_by: financeUser,
      },
      {
        id: `DEP-${1000 + depSeq++}`,
        date: day(-6),
        source: "customer",
        customer_id: c.id,
        method: "mpesa",
        amount_tzs: d2,
        ref: `RCT-${1000 + c.i}B`,
        recorded_by: financeUser,
      },
    );
    outstanding[c.id] = Math.max((outstanding[c.id] ?? 0) - d1 - d2, 0);
  } else if (c.type === "credit") {
    deposits.push({
      id: `DEP-${1000 + depSeq++}`,
      date: day(-16),
      source: "customer",
      customer_id: c.id,
      method: "cash",
      amount_tzs: 30000,
      ref: `RCT-${2000 + c.i}`,
      recorded_by: financeUser,
    });
    outstanding[c.id] = Math.max((outstanding[c.id] ?? 0) - 30000, 0);
  }
}
// Route cash-up + POS banking slips for the deposits log.
deposits.push(
  {
    id: `DEP-${1000 + depSeq++}`,
    date: day(0),
    source: "route",
    method: "cash",
    amount_tzs: 540000,
    ref: "VAN1-CASHUP",
    note: "Van #1 cash-up",
    recorded_by: routeUser,
  },
  {
    id: `DEP-${1000 + depSeq++}`,
    date: day(-1),
    source: "pos",
    method: "bank",
    amount_tzs: 820000,
    ref: "POS-BANKING",
    note: "Counter banking",
    recorded_by: financeUser,
  },
);
await insert("deposits", deposits);

for (const [id, amount] of Object.entries(outstanding)) {
  const { error } = await db.from("customers").update({ outstanding_tzs: amount }).eq("id", id);
  if (error) throw new Error(`customer outstanding: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 10. Expenses + a few audit entries
// ---------------------------------------------------------------------------

await insert("expenses", [
  {
    date: day(0),
    category: "fuel",
    vendor: "Total Sakina",
    description: "Van #1 diesel, 25L",
    amount_tzs: 72500,
    method: "mpesa",
    ref: "M-PESA TX 3D5G7",
    recorded_by: routeUser,
  },
  {
    date: day(0),
    category: "packaging",
    vendor: "Kibo Plastics",
    description: "Vikopo robo, 500 pcs",
    amount_tzs: 125000,
    method: "bank",
    ref: "INV-2034",
    recorded_by: financeUser,
  },
  {
    date: day(-1),
    category: "repairs",
    vendor: "Kiwanja Workshop",
    description: "Cooler thermostat replacement",
    amount_tzs: 180000,
    method: "cash",
    recorded_by: productionUser,
  },
  {
    date: day(-1),
    category: "wages",
    vendor: "Wafanyakazi (8)",
    description: "Wiki iliyopita",
    amount_tzs: 920000,
    method: "cash",
    recorded_by: financeUser,
  },
  {
    date: day(-2),
    category: "utilities",
    vendor: "TANESCO",
    description: "Umeme wa mwezi",
    amount_tzs: 165000,
    method: "mpesa",
    ref: "EVD-7821",
    recorded_by: financeUser,
  },
  {
    date: day(-2),
    category: "transport",
    vendor: "Tindi (collector)",
    description: "Bei ya ukusanyaji wa wiki",
    amount_tzs: 84000,
    method: "cash",
    recorded_by: admin,
  },
  {
    date: day(-3),
    category: "office",
    vendor: "Hostings.tz",
    description: "Mfumo wa hosting kwa mwezi",
    amount_tzs: 38000,
    method: "bank",
    ref: "INV-8821",
    recorded_by: financeUser,
  },
  {
    date: day(-4),
    category: "fuel",
    vendor: "Puma Ngaramtoni",
    description: "Pikipiki ya ukusanyaji",
    amount_tzs: 24000,
    method: "cash",
    recorded_by: admin,
  },
]);

await insert("audit_log", [
  {
    actor: admin,
    actor_name: "Joyce Mollel",
    actor_role: "admin",
    action: "login",
    module: "auth",
    summary_sw: "Ameingia kwenye mfumo",
    summary_en: "Signed in to the system",
  },
  {
    actor: productionUser,
    actor_name: "Daudi Massawe",
    actor_role: "production",
    action: "lock-day",
    module: "reconciliation",
    summary_sw: `Amefunga siku ${day(-1)}`,
    summary_en: `Locked day ${day(-1)}`,
  },
  {
    actor: financeUser,
    actor_name: "Asha Mwakasege",
    actor_role: "finance",
    action: "deposit",
    module: "finance",
    summary_sw: "Amerekodi amana TZS 200,000 (Jovinary Hotel)",
    summary_en: "Recorded deposit TZS 200,000 (Jovinary Hotel)",
  },
  {
    actor: admin,
    actor_name: "Joyce Mollel",
    actor_role: "admin",
    action: "price-change",
    module: "products",
    summary_sw: "Amebadilisha bei ya Fresh milk (own) 1400 kuwa 1500",
    summary_en: "Changed Fresh milk price (own) 1400 to 1500",
  },
]);

console.log("Seed complete. Demo day =", day(0));
