export type Role = "admin" | "finance" | "production" | "sales" | "route" | "store" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: Role[];
  active: boolean;
  avatarColor: string;
  avatarUrl?: string;
}

export type ProductCategory =
  | "fresh-milk"
  | "cultured"
  | "yoghurt"
  | "cream"
  | "cheese"
  | "ghee"
  | "butter";

export type Unit = "L" | "kg" | "pcs";

export interface Product {
  id: string;
  name: string;
  swName: string;
  category: ProductCategory;
  unit: Unit;
  conversionNote?: string;
  /** % of input raw milk litres this product yields when produced (e.g.
   *  cheese ~9-10%, Mtindi/yoghurt ~100%). Unset means production batches
   *  for this product stay fully manual (typed output + wastage). */
  defaultYieldPct?: number;
  active: boolean;
}

export type PriceTier = "own" | "bottle" | "bulk";

export interface PriceMatrix {
  [productId: string]: Record<PriceTier, number>;
}

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  village: string;
  litresThisCycle: number;
  ratePerL: number;
  lastPaymentTZS: number;
  lastPaymentDate: string;
  currentBalanceTZS: number;
  status: "active" | "due" | "delayed" | "paid";
}

export type CustomerType = "cash" | "credit" | "monthly";

/** When a monthly-credit customer settles: "month_end" (default, a full
 *  month's grace, due around the end of the following month) or
 *  "month_start", for the rare customer who pays within the first few days
 *  of the next month instead. Drives the due date on their bill invoices. */
export type BillingCycle = "month_end" | "month_start";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: CustomerType;
  outstandingTZS: number;
  /** Ceiling on what they may owe on credit. Undefined means no limit. */
  creditLimitTZS?: number;
  lastActivity: string;
  status: "active" | "overdue" | "ok";
  remindersEnabled?: boolean;
  suspended?: boolean;
  /** Manual payment due date driving the 5-day + day-of email reminders. */
  nextDueDate?: string;
  billingCycle: BillingCycle;
  monthlyActivity?: CustomerActivity[];
  deposits?: { id: string; date: string; amountTZS: number; ref: string }[];
}

export interface CustomerActivity {
  id: string;
  /** The sale this line belongs to, so a row can be corrected or voided. */
  saleId?: string;
  unitPrice?: number;
  date: string;
  productId: string;
  qty: number;
  unit: Unit;
  amountTZS: number;
  paid: boolean;
}

export interface CollectionEntry {
  id: string;
  farmerId: string;
  date: string;
  session: "morning" | "evening";
  litres: number;
  point: "field-a" | "main";
  /** Real source of truth; `point` is a legacy alias for the two seed points. */
  locationId?: string;
  qualityNote?: string;
  /** The rate that actually applied on this day, captured historically so
   *  a later rate change never distorts what an old statement line shows. */
  ratePerL?: number;
  /** What the farmer brought, where some was refused on quality. */
  offeredLitres?: number;
  rejectReason?: string;
}

export interface StockItem {
  id: string;
  name: string;
  swName?: string;
  productId?: string;
  category: "finished" | "consumable" | "raw";
  unit: Unit;
  onHand: number;
  reorder: number;
  lastMovement: string;
  /** Suspended items keep their history but disappear from forms. */
  active?: boolean;
}

export interface Alert {
  id: string;
  kind: "low-stock" | "overdue-credit" | "farmer-payable" | "day-unbalanced";
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  timeAgo: string;
}
