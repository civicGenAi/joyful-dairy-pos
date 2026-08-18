import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: morning physical stock count, additive to the existing
// reconciliation/day-lock flow (never replaces it). One row per stock item
// per date, upserted via record_stock_count so recounting the same morning
// just overwrites. Raw milk carries a container breakdown, everything else
// is a single counted quantity in its own unit.

export interface StockCount {
  id: string;
  date: string;
  stockItemId: string;
  countedQty: number;
  systemOnHand: number;
  variance: number;
  containers: Record<string, number> | null;
  countedByName?: string;
  countedAt: string;
}

interface StockCountRow {
  id: string;
  date: string;
  stock_item_id: string;
  counted_qty: number;
  system_on_hand: number;
  variance: number;
  containers: Record<string, number> | null;
  profiles?: { name: string } | null;
  counted_at: string;
}

function toStockCount(r: StockCountRow): StockCount {
  return {
    id: r.id,
    date: r.date,
    stockItemId: r.stock_item_id,
    countedQty: Number(r.counted_qty),
    systemOnHand: Number(r.system_on_hand),
    variance: Number(r.variance),
    containers: r.containers,
    countedByName: r.profiles?.name,
    countedAt: r.counted_at,
  };
}

export const stockCountKeys = {
  all: ["stockCounts"] as const,
  byDate: (date: string) => ["stockCounts", "byDate", date] as const,
};

export const stockCountsRepo = {
  async listForDate(date: string): Promise<StockCount[]> {
    const rows = unwrap(
      await supabase.from("stock_counts").select("*, profiles(name)").eq("date", date),
    ) as StockCountRow[];
    return rows.map(toStockCount);
  },

  async record(input: {
    date: string;
    stockItemId: string;
    countedQty: number;
    containers?: Record<string, number>;
  }): Promise<StockCount> {
    const { data, error } = await supabase.rpc("record_stock_count", {
      p_date: input.date,
      p_stock_item_id: input.stockItemId,
      p_counted_qty: input.countedQty,
      p_containers: input.containers ?? null,
    });
    if (error) throw new Error(error.message);
    return toStockCount(data as StockCountRow);
  },
};
