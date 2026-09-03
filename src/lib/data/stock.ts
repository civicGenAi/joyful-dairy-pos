import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { StockItem, Unit } from "@/mock/types";

// BACKEND: stock repository over stock_items + the single movements ledger.

interface StockRow {
  id: string;
  name: string;
  sw_name: string | null;
  product_id: string | null;
  category: "finished" | "consumable" | "raw";
  unit: Unit;
  on_hand: number;
  reorder: number;
  last_movement_at: string | null;
  active?: boolean;
}

function ago(at: string | null, lang: "sw" | "en" = "en"): string {
  if (!at) return "–";
  const mins = Math.max(Math.round((Date.now() - new Date(at).getTime()) / 60000), 0);
  if (mins < 60) return lang === "sw" ? `dk ${mins} zilizopita` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "sw" ? `saa ${hrs} zilizopita` : `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return lang === "sw" ? "Jana" : "Yesterday";
  return lang === "sw" ? `siku ${days} zilizopita` : `${days} days ago`;
}

function toItem(r: StockRow): StockItem {
  return {
    id: r.id,
    name: r.name,
    swName: r.sw_name ?? undefined,
    productId: r.product_id ?? undefined,
    category: r.category,
    unit: r.unit,
    onHand: Number(r.on_hand),
    reorder: Number(r.reorder),
    lastMovement: ago(r.last_movement_at),
    active: r.active ?? true,
  };
}

export interface StockMovement {
  id: string;
  at: string;
  date: string;
  kind: string;
  stockItemId: string | null;
  productId: string | null;
  qty: number;
  unit: Unit;
  ref: string | null;
  reason?: string;
  byName?: string;
}

export const stockKeys = {
  all: ["stock"] as const,
  list: () => ["stock", "list"] as const,
  movements: (itemId?: string, page = 0) => ["stock", "movements", itemId ?? "all", page] as const,
};

interface MovementRow {
  id: string;
  at: string;
  date: string;
  kind: string;
  stock_item_id: string | null;
  product_id: string | null;
  qty: number;
  unit: Unit;
  ref: string | null;
  meta: { reason?: string } | null;
  profiles?: { name: string } | null;
}

function toMovement(r: MovementRow): StockMovement {
  return {
    id: r.id,
    at: r.at,
    date: r.date,
    kind: r.kind,
    stockItemId: r.stock_item_id,
    productId: r.product_id,
    qty: Number(r.qty),
    unit: r.unit,
    ref: r.ref,
    reason: r.meta?.reason,
    byName: r.profiles?.name,
  };
}

export interface StockValuationRow {
  id: string;
  name: string;
  swName: string;
  category: string;
  unit: string;
  onHand: number;
  avgCostTZS: number;
  valueTZS: number;
}

export const stockRepo = {
  /** What the stock on hand is actually worth, at weighted average cost.
   *  The same figure the month-end closing-stock adjustment posts, so the
   *  screen and the balance sheet cannot disagree. */
  async valuation(): Promise<StockValuationRow[]> {
    const { data, error } = await supabase.rpc("stock_valuation");
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        name: string;
        sw_name: string;
        category: string;
        unit: string;
        on_hand: number;
        avg_cost_tzs: number;
        value_tzs: number;
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      swName: r.sw_name,
      category: r.category,
      unit: r.unit,
      onHand: Number(r.on_hand),
      avgCostTZS: Number(r.avg_cost_tzs),
      valueTZS: Number(r.value_tzs),
    }));
  },

  async list(): Promise<StockItem[]> {
    const rows = unwrap(
      await supabase
        .from("stock_items")
        .select("*")
        .is("deleted_at", null)
        .order("category")
        .order("name"),
    ) as StockRow[];
    return rows.map(toItem);
  },

  async movements(limit = 50, offset = 0): Promise<StockMovement[]> {
    const rows = unwrap(
      await supabase
        .from("movements")
        .select("*, profiles(name)")
        .not("stock_item_id", "is", null)
        .order("at", { ascending: false })
        .range(offset, offset + limit - 1),
    ) as MovementRow[];
    return rows.map(toMovement);
  },

  async movementsForItem(itemId: string, limit = 20): Promise<StockMovement[]> {
    const rows = unwrap(
      await supabase
        .from("movements")
        .select("*, profiles(name)")
        .eq("stock_item_id", itemId)
        .order("at", { ascending: false })
        .limit(limit),
    ) as MovementRow[];
    return rows.map(toMovement);
  },

  /** Receive a purchase, issue to a unit, or adjust a count. Via RPC (ledger + audit). */
  async move(input: {
    stockItemId: string;
    kind: "received" | "issued" | "adjusted";
    qty: number;
    reason?: string;
    ref?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_stock_movement", {
      p_stock_item_id: input.stockItemId,
      p_kind: input.kind,
      p_qty: input.qty,
      p_reason: input.reason ?? null,
      p_ref: input.ref ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async recordSpoilage(input: {
    stockItemId: string;
    qty: number;
    reason?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_spoilage", {
      p_stock_item_id: input.stockItemId,
      p_qty: input.qty,
      p_reason: input.reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async recordReturn(input: {
    stockItemId: string;
    qty: number;
    locationId?: string;
    /** Required when a driver overrides the computed return quantity. */
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_return", {
      p_stock_item_id: input.stockItemId,
      p_qty: input.qty,
      p_location_id: input.locationId ?? null,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async updateItem(input: {
    id: string;
    name: string;
    swName?: string;
    unit: Unit;
    reorder: number;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("stock_items")
        .update({
          name: input.name,
          sw_name: input.swName ?? null,
          unit: input.unit,
          reorder: input.reorder,
        })
        .eq("id", input.id)
        .select("id"),
    );
    await recordAudit(
      "edit",
      "stock",
      `Amehariri bidhaa ghalani (${input.name})`,
      `Edited a store item (${input.name})`,
    );
  },

  async setItemActive(id: string, name: string, active: boolean): Promise<void> {
    unwrap(await supabase.from("stock_items").update({ active }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "stock",
      active ? `Amerudisha bidhaa ghalani (${name})` : `Amesimamisha bidhaa ghalani (${name})`,
      active ? `Reactivated store item (${name})` : `Suspended store item (${name})`,
    );
  },

  async setReorder(id: string, name: string, reorder: number): Promise<void> {
    unwrap(await supabase.from("stock_items").update({ reorder }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "stock",
      `Amebadilisha kiwango cha kuagiza (${name}: ${reorder})`,
      `Changed reorder threshold (${name}: ${reorder})`,
    );
  },

  /** Soft delete: removed from every list and form, its movement history
   *  (and the ledger rows that reference it) stays intact and traceable.
   *  Restore from Settings -> Trash. */
  async remove(id: string, name: string): Promise<void> {
    unwrap(
      await supabase
        .from("stock_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id"),
    );
    await recordAudit(
      "delete",
      "stock",
      `Amefuta bidhaa ghalani (${name})`,
      `Deleted store item (${name})`,
    );
  },

  async createItem(input: {
    name: string;
    swName?: string;
    category: "finished" | "consumable" | "raw";
    unit: Unit;
    reorder: number;
    productId?: string;
  }): Promise<StockItem> {
    const row = unwrap(
      await supabase
        .from("stock_items")
        .insert({
          name: input.name,
          sw_name: input.swName ?? null,
          category: input.category,
          unit: input.unit,
          reorder: input.reorder,
          product_id: input.productId ?? null,
        })
        .select("*")
        .single(),
    ) as StockRow;
    await recordAudit(
      "create",
      "stock",
      `Ameongeza bidhaa ghalani (${input.name})`,
      `Added stock item (${input.name})`,
    );
    return toItem(row);
  },
};
