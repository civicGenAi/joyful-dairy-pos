import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: production repository over batches + spoilages.

export interface Batch {
  id: string;
  date: string;
  productId: string;
  inputLitres: number;
  outputQty: number;
  unit: string;
  yieldPct: number | null;
  wastage: number;
  note: string | null;
}

export interface SpoilageEntry {
  id: string;
  date: string;
  stockItemId: string;
  qty: number;
  reason: string | null;
}

export const productionKeys = {
  all: ["production"] as const,
  batches: (date?: string) => ["production", "batches", date ?? "recent"] as const,
  spoilages: (date?: string) => ["production", "spoilages", date ?? "recent"] as const,
  yield: (days: number) => ["production", "yield", days] as const,
};

interface BatchRow {
  id: string;
  date: string;
  product_id: string;
  input_litres: number;
  output_qty: number;
  unit: string;
  yield_pct: number | null;
  wastage: number;
  note: string | null;
}

function toBatch(r: BatchRow): Batch {
  return {
    id: r.id,
    date: r.date,
    productId: r.product_id,
    inputLitres: Number(r.input_litres),
    outputQty: Number(r.output_qty),
    unit: r.unit,
    yieldPct: r.yield_pct === null ? null : Number(r.yield_pct),
    wastage: Number(r.wastage),
    note: r.note,
  };
}

export const productionRepo = {
  async batchesByDate(date: string): Promise<Batch[]> {
    const rows = unwrap(
      await supabase
        .from("batches")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: false }),
    ) as BatchRow[];
    return rows.map(toBatch);
  },

  /** Records a batch via RPC: consumes raw milk, produces finished stock, audits.
   *  outputQty/wastage are optional: omit them for a product with a default
   *  yield % configured and the server computes both (and auto-records the
   *  yield loss as spoilage); pass them explicitly for the fully-manual path. */
  async recordBatch(input: {
    productId: string;
    inputLitres: number;
    outputQty?: number;
    wastage?: number;
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_batch", {
      p_product_id: input.productId,
      p_input_litres: input.inputLitres,
      p_output_qty: input.outputQty ?? null,
      p_wastage: input.wastage ?? null,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async spoilagesByDate(date: string): Promise<SpoilageEntry[]> {
    const rows = unwrap(
      await supabase
        .from("spoilages")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: false }),
    ) as { id: string; date: string; stock_item_id: string; qty: number; reason: string | null }[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      stockItemId: r.stock_item_id,
      qty: Number(r.qty),
      reason: r.reason,
    }));
  },

  async yieldTrend(days = 7): Promise<{ date: string; yieldPct: number | null }[]> {
    const { data, error } = await supabase.rpc("yield_trend", { p_days: days });
    if (error) throw new Error(error.message);
    return (data as { date: string; yield_pct: number | null }[]).map((r) => ({
      date: r.date,
      yieldPct: r.yield_pct === null ? null : Number(r.yield_pct),
    }));
  },
};
