import type {
  Alert,
  CollectionEntry,
  Customer,
  Farmer,
  PriceMatrix,
  Product,
  StockItem,
  User,
} from "./types";

export const COMPANY = {
  name: "African Joy Dairy",
  city: "Arusha, Tanzania",
  tagline: "Premium dairy, empowering women farmers",
  footer: "Asante kwa kuchagua African Joy — Thank you for choosing African Joy.",
};

export const USERS: User[] = [
  { id: "u1", name: "Joyce Mollel", email: "admin@africanjoy.co.tz", phone: "+255 754 100 001", roles: ["admin"], active: true, avatarColor: "#1E7C3F" },
  { id: "u2", name: "Asha Mwakasege", email: "finance@africanjoy.co.tz", phone: "+255 754 100 002", roles: ["finance"], active: true, avatarColor: "#2F9E44" },
  { id: "u3", name: "Daudi Massawe", email: "production@africanjoy.co.tz", phone: "+255 754 100 003", roles: ["production"], active: true, avatarColor: "#6FBF59" },
  { id: "u4", name: "Neema Kileo", email: "sales@africanjoy.co.tz", phone: "+255 754 100 004", roles: ["sales"], active: true, avatarColor: "#8CC63F" },
  { id: "u5", name: "Baraka Laizer", email: "route@africanjoy.co.tz", phone: "+255 754 100 005", roles: ["route"], active: true, avatarColor: "#E11B22" },
  { id: "u6", name: "Mama Esther", email: "store@africanjoy.co.tz", phone: "+255 754 100 006", roles: ["store"], active: true, avatarColor: "#E5A100" },
  { id: "u7", name: "Glory Mushi", email: "viewer@africanjoy.co.tz", phone: "+255 754 100 007", roles: ["viewer"], active: true, avatarColor: "#1D9E75" },
  { id: "u8", name: "Peter Sanare", email: "peter@africanjoy.co.tz", phone: "+255 754 100 008", roles: ["sales", "store"], active: true, avatarColor: "#14532D" },
  { id: "u9", name: "Lightness Kivuyo", email: "lightness@africanjoy.co.tz", phone: "+255 754 100 009", roles: ["finance", "viewer"], active: true, avatarColor: "#0f5d44" },
];

export const ROLE_LABEL: Record<string, { en: string; sw: string }> = {
  admin: { en: "Admin / Owner", sw: "Msimamizi" },
  finance: { en: "Finance", sw: "Fedha" },
  production: { en: "Production Manager", sw: "Meneja Uzalishaji" },
  sales: { en: "Sales / Counter", sw: "Mauzo" },
  route: { en: "Route Worker", sw: "Dereva" },
  store: { en: "Store Keeper", sw: "Ghala" },
  viewer: { en: "Viewer (read-only)", sw: "Mtazamaji" },
};

export const PRODUCTS: Product[] = [
  { id: "p-fresh", name: "Fresh milk", swName: "Maziwa Fresh", category: "fresh-milk", unit: "L", active: true },
  { id: "p-mtindi", name: "Cultured milk (Mtindi)", swName: "Mtindi", category: "cultured", unit: "L", active: true },
  { id: "p-yog-straw", name: "Yoghurt Strawberry 500ml", swName: "Yogati Strawberry", category: "yoghurt", unit: "pcs", active: true },
  { id: "p-yog-van", name: "Yoghurt Vanilla 500ml", swName: "Yogati Vanilla", category: "yoghurt", unit: "pcs", active: true },
  { id: "p-yog-greek", name: "Yoghurt Greek 500ml", swName: "Yogati Greek", category: "yoghurt", unit: "pcs", active: true },
  { id: "p-yog-nat", name: "Yoghurt Natural 500ml", swName: "Yogati Asili", category: "yoghurt", unit: "pcs", active: true },
  { id: "p-cream", name: "Cream", swName: "Krimu", category: "cream", unit: "L", active: true },
  { id: "p-mozz", name: "Mozzarella", swName: "Mozzarella", category: "cheese", unit: "kg", conversionNote: "244 L ≈ 20 kg", active: true },
  { id: "p-gouda", name: "Gouda", swName: "Gouda", category: "cheese", unit: "kg", conversionNote: "Aged 30 days", active: true },
  { id: "p-hall", name: "Halloumi", swName: "Halloumi", category: "cheese", unit: "kg", conversionNote: "75 L ≈ 6.35 kg", active: true },
  { id: "p-ched", name: "Cheddar", swName: "Cheddar", category: "cheese", unit: "kg", active: true },
  { id: "p-pan", name: "Paneer", swName: "Paneer", category: "cheese", unit: "kg", active: true },
  { id: "p-feta", name: "Feta", swName: "Feta", category: "cheese", unit: "kg", active: true },
  { id: "p-ghee", name: "Ghee", swName: "Samli", category: "ghee", unit: "L", active: true },
  { id: "p-butter", name: "Butter 250g", swName: "Siagi 250g", category: "butter", unit: "pcs", active: true },
];

export const PRICE_MATRIX: PriceMatrix = {
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

const farmerNames = [
  "Godfrey Mosses Nassary","John Frison Mollel","Idda Amani Kirenga","Mama Lightness",
  "Nathani Olesirikan","Simon Makundi","Gilliard Daniel","Emson Saruni Laizer",
  "Viki Rabson Kivuyo","Amanulas Ackson Kibora","Glory Fanuel Lukumay","Maria Mathayo Sanare",
  "Mama Joel","Goodluck Msafiri Mkubwa","Jackline Ibrahim Kivuyo",
];
const villages = ["Olasiti", "Sakina", "Kisongo", "Ngaramtoni", "Tengeru", "Usa River"];

export const FARMERS: Farmer[] = farmerNames.map((name, i) => {
  const litres = 8 + Math.round(((i * 17) % 110));
  const total = litres * 15;
  const accrued = total * 1200;
  const balance = i % 4 === 0 ? accrued : Math.round(accrued * 0.4);
  const status = i % 5 === 0 ? "delayed" : i % 3 === 0 ? "due" : i % 7 === 0 ? "paid" : "active";
  return {
    id: `f${i + 1}`,
    name,
    phone: `+255 7${20 + i} 4${(i * 7) % 100}${100 + i}`,
    village: villages[i % villages.length],
    litresThisCycle: total,
    ratePerL: 1200,
    lastPaymentTZS: i % 2 === 0 ? 540000 + i * 5000 : 320000 + i * 4000,
    lastPaymentDate: `2026-05-${15 - (i % 10)}`,
    currentBalanceTZS: balance,
    status,
  };
});

const customerNames: { name: string; type: "cash" | "credit" | "monthly" }[] = [
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

const productPool = ["p-fresh", "p-mtindi", "p-yog-straw", "p-yog-van", "p-cream", "p-mozz", "p-ghee", "p-butter"];

export const CUSTOMERS: Customer[] = customerNames.map((c, i) => {
  const isMonthly = c.type === "monthly";
  const isOverdue = i % 4 === 0;
  const baseOutstanding = c.type === "cash" ? 0 : isMonthly ? 250000 + i * 35000 : 40000 + i * 8000;

  const activities = isMonthly
    ? Array.from({ length: 18 }).map((_, k) => {
        const pid = productPool[(k + i) % productPool.length];
        const price = PRICE_MATRIX[pid].bulk;
        const qty = pid.startsWith("p-mozz") || pid.startsWith("p-ghee") ? 2 + (k % 3) : 4 + (k % 6);
        return {
          id: `a-${i}-${k}`,
          date: `2026-05-${String(2 + (k * 30) % 28).padStart(2, "0")}`,
          productId: pid,
          qty,
          unit: pid.startsWith("p-mozz") || pid.startsWith("p-pan") || pid.startsWith("p-hall") ? "kg" as const : pid.startsWith("p-butter") || pid.startsWith("p-yog") ? "pcs" as const : "L" as const,
          amountTZS: qty * price,
          paid: false,
        };
      })
    : Array.from({ length: 6 }).map((_, k) => {
        const pid = productPool[(k + i) % productPool.length];
        const price = PRICE_MATRIX[pid].own;
        const qty = 2 + (k % 4);
        return {
          id: `a-${i}-${k}`,
          date: `2026-05-${String(5 + k * 4).padStart(2, "0")}`,
          productId: pid,
          qty,
          unit: pid.startsWith("p-mozz") || pid.startsWith("p-pan") || pid.startsWith("p-hall") ? "kg" as const : pid.startsWith("p-butter") || pid.startsWith("p-yog") ? "pcs" as const : "L" as const,
          amountTZS: qty * price,
          paid: c.type === "cash",
        };
      });

  const deposits = isMonthly
    ? [
        { id: `d-${i}-1`, date: "2026-05-10", amountTZS: 150000 + i * 10000, ref: `RCT-${1000 + i}A` },
        { id: `d-${i}-2`, date: "2026-05-22", amountTZS: 200000 + i * 8000, ref: `RCT-${1000 + i}B` },
      ]
    : c.type === "credit"
    ? [{ id: `d-${i}-1`, date: "2026-05-12", amountTZS: 30000, ref: `RCT-${2000 + i}` }]
    : [];

  return {
    id: `c${i + 1}`,
    name: c.name,
    phone: `+255 78${i} ${100 + i}${i}${i} ${200 + i}`,
    type: c.type,
    outstandingTZS: baseOutstanding,
    lastActivity: `2026-05-${28 - (i % 20)}`,
    status: isOverdue && c.type !== "cash" ? "overdue" : "ok",
    monthlyActivity: activities,
    deposits,
  };
});

export const STOCK: StockItem[] = [
  // Finished
  { id: "s-fresh", productId: "p-fresh", name: "Fresh milk", category: "finished", unit: "L", onHand: 240, reorder: 100, lastMovement: "10 min ago" },
  { id: "s-mtindi", productId: "p-mtindi", name: "Mtindi", category: "finished", unit: "L", onHand: 180, reorder: 80, lastMovement: "23 min ago" },
  { id: "s-yog-straw", productId: "p-yog-straw", name: "Yoghurt Strawberry 500ml", category: "finished", unit: "pcs", onHand: 36, reorder: 60, lastMovement: "1 hr ago" },
  { id: "s-yog-van", productId: "p-yog-van", name: "Yoghurt Vanilla 500ml", category: "finished", unit: "pcs", onHand: 84, reorder: 60, lastMovement: "1 hr ago" },
  { id: "s-cream", productId: "p-cream", name: "Cream", category: "finished", unit: "L", onHand: 18, reorder: 25, lastMovement: "2 hr ago" },
  { id: "s-mozz", productId: "p-mozz", name: "Mozzarella", category: "finished", unit: "kg", onHand: 12, reorder: 8, lastMovement: "3 hr ago" },
  { id: "s-hall", productId: "p-hall", name: "Halloumi", category: "finished", unit: "kg", onHand: 4.2, reorder: 5, lastMovement: "4 hr ago" },
  { id: "s-pan", productId: "p-pan", name: "Paneer", category: "finished", unit: "kg", onHand: 7, reorder: 5, lastMovement: "5 hr ago" },
  { id: "s-ghee", productId: "p-ghee", name: "Ghee", category: "finished", unit: "L", onHand: 22, reorder: 15, lastMovement: "Yesterday" },
  { id: "s-butter", productId: "p-butter", name: "Butter 250g", category: "finished", unit: "pcs", onHand: 0, reorder: 20, lastMovement: "Yesterday" },
  // Consumables (real store sheet)
  { id: "c-mad5", name: "Madumu 5L", swName: "Madumu 5L", category: "consumable", unit: "pcs", onHand: 26, reorder: 20, lastMovement: "Today" },
  { id: "c-mad3", name: "Madumu 3L", swName: "Madumu 3L", category: "consumable", unit: "pcs", onHand: 14, reorder: 20, lastMovement: "Today" },
  { id: "c-vik-n", name: "Vikopo vya nusu", swName: "Vikopo nusu", category: "consumable", unit: "pcs", onHand: 320, reorder: 200, lastMovement: "Today" },
  { id: "c-vik-r", name: "Vikopo vya robo", swName: "Vikopo robo", category: "consumable", unit: "pcs", onHand: 140, reorder: 200, lastMovement: "Today" },
  { id: "c-vik-150", name: "Vikopo vya 150ml", category: "consumable", unit: "pcs", onHand: 480, reorder: 300, lastMovement: "Today" },
  { id: "c-vik-100", name: "Vikopo vya 100ml", category: "consumable", unit: "pcs", onHand: 90, reorder: 150, lastMovement: "Today" },
  { id: "c-trays", name: "Trays", swName: "Trei", category: "consumable", unit: "pcs", onHand: 18, reorder: 10, lastMovement: "Yesterday" },
  { id: "c-box", name: "Box ndogo", swName: "Box ndogo", category: "consumable", unit: "pcs", onHand: 6, reorder: 12, lastMovement: "Yesterday" },
];

export const COLLECTIONS_TODAY: CollectionEntry[] = FARMERS.flatMap((f, i) => [
  { id: `col-${i}-m`, farmerId: f.id, date: "2026-05-28", session: "morning", litres: Math.round(f.litresThisCycle / 15 * 0.6), point: i % 2 === 0 ? "field-a" : "main" },
  { id: `col-${i}-e`, farmerId: f.id, date: "2026-05-28", session: "evening", litres: Math.round(f.litresThisCycle / 15 * 0.4), point: i % 3 === 0 ? "field-a" : "main" },
]);

export const ALERTS: Alert[] = [
  { id: "al-1", kind: "low-stock", title: "Butter 250g is out of stock", detail: "Last sale 2 days ago — reorder threshold 20 pcs", severity: "danger", timeAgo: "10 min ago" },
  { id: "al-2", kind: "low-stock", title: "Halloumi running low", detail: "On hand 4.2 kg, threshold 5 kg", severity: "warning", timeAgo: "1 hr ago" },
  { id: "al-3", kind: "low-stock", title: "Vikopo vya robo low", detail: "Balance 140 pcs, threshold 200 pcs", severity: "warning", timeAgo: "2 hr ago" },
  { id: "al-4", kind: "overdue-credit", title: "Mamis Bistro overdue", detail: "TZS 420,000 overdue 12 days", severity: "danger", timeAgo: "Today" },
  { id: "al-5", kind: "overdue-credit", title: "Walter Sanare overdue", detail: "TZS 38,500 overdue 18 days", severity: "warning", timeAgo: "Today" },
  { id: "al-6", kind: "farmer-payable", title: "15-day payout due in 3 days", detail: "12 farmers, total TZS 4,830,000", severity: "info", timeAgo: "Today" },
  { id: "al-7", kind: "day-unbalanced", title: "Yesterday not yet locked", detail: "Production manager to confirm day-close", severity: "warning", timeAgo: "Yesterday" },
];

// 30-day milk trend
export const MILK_TREND_30 = Array.from({ length: 30 }).map((_, i) => {
  const base = 820 + Math.sin(i / 3) * 80 + (i % 5) * 6;
  return {
    day: `D${i + 1}`,
    collected: Math.round(base),
    sold: Math.round(base * 0.62 + (i % 4) * 8),
    spoilt: Math.round(8 + (i % 6) * 2),
  };
});

export const SALES_BY_CATEGORY_WEEK = [
  { day: "Mon", "Fresh milk": 240, Mtindi: 190, Yoghurt: 120, Cheese: 70, Ghee: 35, Butter: 18 },
  { day: "Tue", "Fresh milk": 260, Mtindi: 210, Yoghurt: 140, Cheese: 80, Ghee: 30, Butter: 22 },
  { day: "Wed", "Fresh milk": 220, Mtindi: 180, Yoghurt: 110, Cheese: 60, Ghee: 28, Butter: 16 },
  { day: "Thu", "Fresh milk": 300, Mtindi: 230, Yoghurt: 160, Cheese: 90, Ghee: 40, Butter: 24 },
  { day: "Fri", "Fresh milk": 320, Mtindi: 250, Yoghurt: 180, Cheese: 100, Ghee: 45, Butter: 30 },
  { day: "Sat", "Fresh milk": 360, Mtindi: 280, Yoghurt: 200, Cheese: 120, Ghee: 50, Butter: 32 },
  { day: "Sun", "Fresh milk": 280, Mtindi: 200, Yoghurt: 140, Cheese: 70, Ghee: 30, Butter: 18 },
];

export const SALES_CHANNEL_SPLIT = [
  { name: "Counter", value: 48 },
  { name: "Route", value: 34 },
  { name: "M-Pesa", value: 18 },
];

export const TOP_CUSTOMERS = [
  { name: "Mamis Bistro", value: 1820000 },
  { name: "Jovinary Hotel", value: 1540000 },
  { name: "CSR Hotel", value: 1320000 },
  { name: "Rashda Suites", value: 1180000 },
  { name: "Nyumbani Cafe", value: 980000 },
  { name: "Sidhu Restaurant", value: 840000 },
  { name: "Valonia Apartment", value: 760000 },
  { name: "Walter Sanare", value: 410000 },
];

export const YIELD_WEEK = [
  { day: "Mon", yield: 81 },
  { day: "Tue", yield: 83 },
  { day: "Wed", yield: 80 },
  { day: "Thu", yield: 85 },
  { day: "Fri", yield: 84 },
  { day: "Sat", yield: 86 },
  { day: "Sun", yield: 82 },
];

// Daily reconciliation
export const RECON_TODAY = [
  { product: "Fresh milk (L)", opening: 60, collected: 880, produced: 0, soldCash: 380, soldCredit: 120, separated: 320, spoilt: 12, returned: 14, closing: 94 },
  { product: "Mtindi (L)", opening: 40, collected: 0, produced: 220, soldCash: 110, soldCredit: 80, separated: 0, spoilt: 4, returned: 6, closing: 60 },
  { product: "Cream (L)", opening: 6, collected: 0, produced: 32, soldCash: 12, soldCredit: 5, separated: 0, spoilt: 0, returned: 0, closing: 21 },
  { product: "Mozzarella (kg)", opening: 2, collected: 0, produced: 20, soldCash: 8, soldCredit: 2, separated: 0, spoilt: 0, returned: 0, closing: 12 },
  { product: "Halloumi (kg)", opening: 1, collected: 0, produced: 6.35, soldCash: 2, soldCredit: 1, separated: 0, spoilt: 0, returned: 0, closing: 4.2 },
  { product: "Ghee (L)", opening: 18, collected: 0, produced: 6, soldCash: 1, soldCredit: 0, separated: 0, spoilt: 0, returned: 0, closing: 23 },
];

// Route module load/sell defaults
export const ROUTE_LOAD = [
  { productId: "p-fresh", litres: 120 },
  { productId: "p-mtindi", litres: 60 },
  { productId: "p-yog-straw", litres: 24 },
];

export const NAV_GROUPS_BY_ROLE: Record<string, { group: string; sw: string; items: { to: string; label: string; sw: string; icon: string }[] }[]> = {
  admin: [
    { group: "Overview", sw: "Muhtasari", items: [{ to: "/dashboard", label: "Dashboard", sw: "Dashibodi", icon: "LayoutDashboard" }] },
    { group: "Procurement", sw: "Ununuzi", items: [
      { to: "/farmers", label: "Farmers", sw: "Wafugaji", icon: "Users" },
      { to: "/collection-points", label: "Collection points", sw: "Pointi za ukusanyaji", icon: "MapPin" },
    ]},
    { group: "Sales", sw: "Mauzo", items: [
      { to: "/pos", label: "Counter POS", sw: "Mauzo Kaunta", icon: "Receipt" },
      { to: "/van", label: "Route module", sw: "Njia", icon: "Truck" },
      { to: "/customers", label: "Customers", sw: "Wateja", icon: "UserSquare2" },
    ]},
    { group: "Operations", sw: "Uendeshaji", items: [
      { to: "/production", label: "Production", sw: "Uzalishaji", icon: "Factory" },
      { to: "/stock", label: "Stock & store", sw: "Ghala", icon: "Boxes" },
      { to: "/reconciliation", label: "Day reconciliation", sw: "Funga siku", icon: "ClipboardCheck" },
    ]},
    { group: "Finance", sw: "Fedha", items: [
      { to: "/finance", label: "Finance", sw: "Fedha", icon: "Wallet" },
    ]},
    { group: "Insights", sw: "Ripoti", items: [
      { to: "/reports", label: "Reports", sw: "Ripoti", icon: "BarChart3" },
      { to: "/products", label: "Products & pricing", sw: "Bidhaa", icon: "Tag" },
    ]},
    { group: "System", sw: "Mfumo", items: [
      { to: "/settings", label: "Settings", sw: "Mipangilio", icon: "Settings" },
    ]},
  ],
  finance: [
    { group: "Overview", sw: "Muhtasari", items: [{ to: "/dashboard", label: "Dashboard", sw: "Dashibodi", icon: "LayoutDashboard" }] },
    { group: "Finance", sw: "Fedha", items: [
      { to: "/customers", label: "Customers", sw: "Wateja", icon: "UserSquare2" },
      { to: "/farmers", label: "Farmer payables", sw: "Malipo wafugaji", icon: "Users" },
      { to: "/finance", label: "Deposits & receipts", sw: "Amana", icon: "Wallet" },
      { to: "/reconciliation", label: "Day-close confirm", sw: "Funga siku", icon: "ClipboardCheck" },
    ]},
    { group: "Insights", sw: "Ripoti", items: [{ to: "/reports", label: "Reports", sw: "Ripoti", icon: "BarChart3" }] },
  ],
  production: [
    { group: "Overview", sw: "Muhtasari", items: [{ to: "/dashboard", label: "Dashboard", sw: "Dashibodi", icon: "LayoutDashboard" }] },
    { group: "Operations", sw: "Uendeshaji", items: [
      { to: "/production", label: "Production", sw: "Uzalishaji", icon: "Factory" },
      { to: "/stock", label: "Finished stock", sw: "Ghala", icon: "Boxes" },
      { to: "/reconciliation", label: "Day reconciliation", sw: "Funga siku", icon: "ClipboardCheck" },
    ]},
    { group: "Insights", sw: "Ripoti", items: [{ to: "/reports", label: "Reports", sw: "Ripoti", icon: "BarChart3" }] },
  ],
  sales: [
    { group: "Sales", sw: "Mauzo", items: [
      { to: "/pos", label: "Counter POS", sw: "Mauzo Kaunta", icon: "Receipt" },
      { to: "/customers", label: "Customers", sw: "Wateja", icon: "UserSquare2" },
      { to: "/stock", label: "Finished stock", sw: "Ghala", icon: "Boxes" },
    ]},
  ],
  route: [
    { group: "Route", sw: "Njia", items: [{ to: "/van", label: "Route module", sw: "Njia", icon: "Truck" }] },
  ],
  store: [
    { group: "Store", sw: "Ghala", items: [
      { to: "/stock", label: "Stock & store", sw: "Ghala", icon: "Boxes" },
    ]},
  ],
  viewer: [
    { group: "Overview", sw: "Muhtasari", items: [{ to: "/dashboard", label: "Dashboard", sw: "Dashibodi", icon: "LayoutDashboard" }] },
    { group: "Insights", sw: "Ripoti", items: [{ to: "/reports", label: "Reports", sw: "Ripoti", icon: "BarChart3" }] },
  ],
};
