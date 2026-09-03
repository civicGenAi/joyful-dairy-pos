import { supabase, unwrap } from "@/lib/api/client";
import { todayISO } from "@/lib/data/dates";
import type { PriceTier, Unit } from "@/mock/types";

// BACKEND: sales repository. complete_sale is fully transactional server-side
// (sale + lines + ledger movements + customer balance + audit).

export interface SaleLineInput {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  at: string;
  date: string;
  channel: "counter" | "route";
  customerId: string | null;
  customerName: string | null;
  payment: "cash" | "credit" | "mpesa" | "stock-issue";
  tier: PriceTier;
  totalTZS: number;
  soldByName?: string;
  lines?: SaleLine[];
  /** Scanned receipt (the Mpesa confirmation screenshot), the single
   *  source of truth for a mobile-money sale. */
  receiptUrl?: string | null;
}

export interface SaleLine {
  id: string;
  productId: string;
  qty: number;
  unit: Unit;
  unitPrice: number;
  amountTZS: number;
}

interface SaleRow {
  id: string;
  at: string;
  date: string;
  channel: "counter" | "route";
  customer_id: string | null;
  customer_name: string | null;
  payment: Sale["payment"];
  tier: PriceTier;
  total_tzs: number;
  voided: boolean;
  receipt_url?: string | null;
  profiles?: { name: string } | null;
  sale_lines?: SaleLineRow[];
}

interface SaleLineRow {
  id: string;
  product_id: string;
  qty: number;
  unit: Unit;
  unit_price: number;
  amount_tzs: number;
}

function toSale(r: SaleRow): Sale {
  return {
    id: r.id,
    at: r.at,
    date: r.date,
    channel: r.channel,
    customerId: r.customer_id,
    customerName: r.customer_name,
    payment: r.payment,
    tier: r.tier,
    totalTZS: Number(r.total_tzs),
    soldByName: r.profiles?.name,
    receiptUrl: r.receipt_url,
    lines: r.sale_lines?.map((l) => ({
      id: l.id,
      productId: l.product_id,
      qty: Number(l.qty),
      unit: l.unit,
      unitPrice: Number(l.unit_price),
      amountTZS: Number(l.amount_tzs),
    })),
  };
}

export const saleKeys = {
  all: ["sales"] as const,
  byDate: (date: string, channel?: string) => ["sales", "byDate", date, channel ?? "all"] as const,
  byId: (id: string) => ["sales", "byId", id] as const,
};

export const salesRepo = {
  /** Completes a sale via the transactional RPC and returns the receipt id.
   *  `clientRef` makes the call idempotent: retrying with the same ref after
   *  a dropped connection returns the sale already recorded by the first
   *  attempt instead of creating a duplicate. The offline sales queue
   *  (src/lib/offline/salesQueue.ts) relies on this to replay safely. */
  async complete(input: {
    channel: "counter" | "route";
    payment: Sale["payment"];
    tier: PriceTier;
    lines: SaleLineInput[];
    customerId?: string;
    locationId?: string;
    clientRef?: string;
    /** Scanned receipt URL, so a mobile-money sale carries the actual
     *  confirmation photo instead of just the "mpesa" tag. */
    receiptUrl?: string;
    /** Defaults to today, pass an earlier date to backfill a customer's
     *  actual delivery/intake date (e.g. recording day 17 on day 20). */
    date?: string;
  }): Promise<Sale> {
    const { data, error } = await supabase.rpc("complete_sale", {
      p_channel: input.channel,
      p_payment: input.payment,
      p_tier: input.tier,
      p_lines: input.lines.map((l) => ({
        product_id: l.productId,
        qty: l.qty,
        unit_price: l.unitPrice,
      })),
      p_customer_id: input.customerId ?? null,
      p_location_id: input.locationId ?? null,
      p_client_ref: input.clientRef ?? null,
      p_receipt_url: input.receiptUrl ?? null,
      p_date: input.date ?? todayISO(),
    });
    if (error) throw new Error(error.message);
    return toSale(data as SaleRow);
  },

  async listByDate(date: string, channel?: "counter" | "route"): Promise<Sale[]> {
    let q = supabase
      .from("sales")
      .select("*, sale_lines(*), profiles(name)")
      .eq("date", date)
      .eq("voided", false)
      .order("at", { ascending: false });
    if (channel) q = q.eq("channel", channel);
    const rows = unwrap(await q) as SaleRow[];
    return rows.map(toSale);
  },

  async byId(id: string): Promise<Sale> {
    const row = unwrap(
      await supabase.from("sales").select("*, sale_lines(*), profiles(name)").eq("id", id).single(),
    ) as SaleRow;
    return toSale(row);
  },

  /** Voids a receipt: reverses its stock movements and any credit balance
   *  it created, via the transactional RPC. Only possible on an unlocked day. */
  async void(input: { saleId: string; reason?: string }): Promise<Sale> {
    const { data, error } = await supabase.rpc("void_sale", {
      p_sale_id: input.saleId,
      p_reason: input.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return toSale(data as SaleRow);
  },
};

// Bilingual display label per deposit source. The 4 fixed sources plus the
// initial 7 sales-deposit categories are named here for a nicer label; any
// later custom category (typed by staff, see salesDepositCategoriesRepo)
// just falls back to its own raw name in both languages, same as expense
// categories already do.
export const SOURCE_LABEL: Record<string, { sw: string; en: string }> = {
  customer: { sw: "Amana ya mteja", en: "Customer deposit" },
  route: { sw: "Cash ya njia", en: "Route cash-up" },
  pos: { sw: "Cash benki", en: "Cash banking" },
  other: { sw: "Nyingine", en: "Other" },
  "fresh-milk": { sw: "Mauzo ya maziwa", en: "Fresh milk sales" },
  mtindi: { sw: "Mtindi", en: "Mtindi" },
  yogurt: { sw: "Yogati", en: "Yoghurt" },
  butter: { sw: "Siagi", en: "Butter" },
  shambani: { sw: "Shambani", en: "Shambani" },
  masoko: { sw: "Masoko", en: "Masoko" },
  madumu: { sw: "Madumu", en: "Madumu" },
};

// "pos" | "route" | "customer" | "other" are the fixed, structural sources,
// each already has its own dedicated recording flow elsewhere. Anything
// else is a sales-deposit category (fresh milk, mtindi, an outlet like
// Shambani, ...), an open set backed by sales_deposit_categories so a
// newly-typed one is remembered, see salesDepositCategoriesRepo below.
export interface DepositRecord {
  id: string;
  date: string;
  at: string;
  source: string;
  customerId: string | null;
  customerName?: string;
  method: "cash" | "mpesa" | "bank";
  amountTZS: number;
  ref: string | null;
  note: string | null;
  attachmentUrl: string | null;
}

export const depositKeys = {
  all: ["deposits"] as const,
  list: () => ["deposits", "list"] as const,
  byId: (id: string) => ["deposits", "byId", id] as const,
  byRange: (from: string, to: string) => ["deposits", "byRange", from, to] as const,
};

interface DepositRow {
  id: string;
  date: string;
  at: string;
  source: DepositRecord["source"];
  customer_id: string | null;
  method: DepositRecord["method"];
  amount_tzs: number;
  ref: string | null;
  note: string | null;
  attachment_url?: string | null;
  customers?: { name: string } | null;
}

function toDeposit(r: DepositRow): DepositRecord {
  return {
    id: r.id,
    date: r.date,
    at: r.at,
    source: r.source,
    customerId: r.customer_id,
    customerName: r.customers?.name,
    method: r.method,
    amountTZS: Number(r.amount_tzs),
    ref: r.ref,
    note: r.note,
    attachmentUrl: r.attachment_url ?? null,
  };
}

export const depositsRepo = {
  async list(limit = 50): Promise<DepositRecord[]> {
    const rows = unwrap(
      await supabase
        .from("deposits")
        .select("*, customers(name)")
        .order("at", { ascending: false })
        .limit(limit),
    ) as DepositRow[];
    return rows.map(toDeposit);
  },

  async byId(id: string): Promise<DepositRecord> {
    const row = unwrap(
      await supabase.from("deposits").select("*, customers(name)").eq("id", id).single(),
    ) as DepositRow;
    return toDeposit(row);
  },

  /** All deposits within a date range, uncapped, for a monthly view. */
  async listByRange(fromDate: string, toDate: string): Promise<DepositRecord[]> {
    const rows = unwrap(
      await supabase
        .from("deposits")
        .select("*, customers(name)")
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date"),
    ) as DepositRow[];
    return rows.map(toDeposit);
  },

  /**
   * Generic deposit slip (route cash-up, counter banking, other income).
   * The reference is system-generated (AJD-DEP-YYMMDD-seq) unless supplied.
   */
  async record(input: {
    source: DepositRecord["source"];
    method: DepositRecord["method"];
    amountTZS: number;
    customerId?: string;
    ref?: string;
    note?: string;
    attachmentUrl?: string;
    date?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_deposit", {
      p_source: input.source,
      p_method: input.method,
      p_amount: input.amountTZS,
      p_customer_id: input.customerId ?? null,
      p_ref: input.ref ?? null,
      p_note: input.note ?? null,
      p_attachment_url: input.attachmentUrl ?? null,
      ...(input.date ? { p_date: input.date } : {}),
    });
    if (error) throw new Error(error.message);
  },
};

// Sales-deposit categories (fresh milk, mtindi, an outlet like Shambani, ...):
// an open set, not a fixed enum, so a newly-typed one is offered again
// next time instead of everything uncommon falling into "other".
export const salesDepositCategoriesRepo = {
  async list(): Promise<string[]> {
    const rows = unwrap(
      await supabase.from("sales_deposit_categories").select("name").order("name"),
    ) as { name: string }[];
    return rows.map((r) => r.name);
  },

  /** Safe to call with an already-existing name, just does nothing. */
  async create(name: string): Promise<void> {
    unwrap(
      await supabase
        .from("sales_deposit_categories")
        .upsert({ name }, { onConflict: "name" })
        .select(),
    );
  },
};
