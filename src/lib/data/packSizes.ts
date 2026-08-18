import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";

// BACKEND: configurable container/pack sizes per stock item (e.g. raw milk's
// ndoo/galoni/chupa, or Mtindi's own cup/bottle sizes). Keyed by stock item
// because raw milk has no row in `products`. Drives the Morning Count
// screen's per-container breakdown for whichever items have sizes set up.

export interface PackSize {
  id: string;
  stockItemId: string;
  label: string;
  qtyPerPack: number;
}

interface PackSizeRow {
  id: string;
  stock_item_id: string;
  label: string;
  qty_per_pack: number;
}

function toPackSize(r: PackSizeRow): PackSize {
  return {
    id: r.id,
    stockItemId: r.stock_item_id,
    label: r.label,
    qtyPerPack: Number(r.qty_per_pack),
  };
}

export const packSizeKeys = {
  all: ["packSizes"] as const,
};

export const packSizesRepo = {
  /** All configured pack sizes, across every item, one round trip, grouped
   *  client-side. The Morning Count screen needs this for every item at once. */
  async listAll(): Promise<PackSize[]> {
    const rows = unwrap(
      await supabase
        .from("stock_item_pack_sizes")
        .select("*")
        .eq("active", true)
        .order("qty_per_pack", { ascending: false }),
    ) as PackSizeRow[];
    return rows.map(toPackSize);
  },

  async create(input: {
    stockItemId: string;
    label: string;
    qtyPerPack: number;
  }): Promise<PackSize> {
    const row = unwrap(
      await supabase
        .from("stock_item_pack_sizes")
        .insert({
          stock_item_id: input.stockItemId,
          label: input.label,
          qty_per_pack: input.qtyPerPack,
        })
        .select("*")
        .single(),
    ) as PackSizeRow;
    await recordAudit(
      "create",
      "stock",
      `Ameongeza kipimo (${input.label})`,
      `Added pack size (${input.label})`,
    );
    return toPackSize(row);
  },

  async remove(id: string, label: string): Promise<void> {
    unwrap(await supabase.from("stock_item_pack_sizes").delete().eq("id", id).select("id"));
    await recordAudit(
      "delete",
      "stock",
      `Amefuta kipimo (${label})`,
      `Removed pack size (${label})`,
    );
  },
};
