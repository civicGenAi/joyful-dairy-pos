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

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: CustomerType;
  outstandingTZS: number;
  lastActivity: string;
  status: "active" | "overdue" | "ok";
  remindersEnabled?: boolean;
  suspended?: boolean;
  /** Manual payment due date driving the 5-day + day-of email reminders. */
  nextDueDate?: string;
  monthlyActivity?: CustomerActivity[];
  deposits?: { id: string; date: string; amountTZS: number; ref: string }[];
}

export interface CustomerActivity {
  id: string;
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
}

export interface Alert {
  id: string;
  kind: "low-stock" | "overdue-credit" | "farmer-payable" | "day-unbalanced";
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  timeAgo: string;
}
