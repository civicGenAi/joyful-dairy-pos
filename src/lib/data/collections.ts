import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { CollectionEntry } from "@/mock/types";

// BACKEND: collections + transfers repository. Replaces COLLECTIONS_TODAY.

interface CollectionRow {
  id: string;
  farmer_id: string;
  date: string;
  session: "morning" | "evening";
  litres: number;
  location_id: string;
  quality_note: string | null;
  created_at?: string;
  farmers?: { name: string } | null;
}

export type CollectionWithFarmer = CollectionEntry & {
  farmerName?: string;
  createdAt?: string;
};

// The UI's CollectionEntry uses point: "field-a" | "main"; map from location ids.
function toEntry(r: CollectionRow): CollectionWithFarmer {
  return {
    id: r.id,
    farmerId: r.farmer_id,
    date: r.date,
    session: r.session,
    litres: Number(r.litres),
    point: r.location_id === "loc-field-a" ? "field-a" : "main",
    locationId: r.location_id,
    qualityNote: r.quality_note ?? undefined,
    farmerName: r.farmers?.name,
    createdAt: r.created_at,
  };
}

export interface TransferEntry {
  id: string;
  date: string;
  createdAt: string;
  fromLocation: string;
  toLocation: string;
  stockItemId: string | null;
  qty: number;
  unit: string;
  note: string | null;
}

export const collectionKeys = {
  all: ["collections"] as const,
  byDate: (date: string) => ["collections", "byDate", date] as const,
  byFarmer: (farmerId: string, from: string) =>
    ["collections", "byFarmer", farmerId, from] as const,
  transfers: (date?: string) => ["transfers", date ?? "recent"] as const,
};

export const collectionsRepo = {
  async listByDate(date: string): Promise<CollectionWithFarmer[]> {
    const rows = unwrap(
      await supabase
        .from("collections")
        .select("*, farmers(name)")
        .eq("date", date)
        .order("created_at", { ascending: false }),
    ) as CollectionRow[];
    return rows.map(toEntry);
  },

  async listByFarmer(farmerId: string, fromDate: string): Promise<CollectionEntry[]> {
    const rows = unwrap(
      await supabase
        .from("collections")
        .select("*")
        .eq("farmer_id", farmerId)
        .gte("date", fromDate)
        .order("date"),
    ) as CollectionRow[];
    return rows.map(toEntry);
  },

  /** Records an intake through the server RPC (ledger + farmer balance + audit). */
  async record(input: {
    farmerId: string;
    date: string;
    session: "morning" | "evening";
    litres: number;
    /** Any active collection-point or plant location id. */
    locationId: string;
    qualityNote?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_collection", {
      p_farmer_id: input.farmerId,
      p_date: input.date,
      p_session: input.session,
      p_litres: input.litres,
      p_location_id: input.locationId,
      p_quality_note: input.qualityNote ?? null,
    });
    if (error) throw new Error(error.message);
  },
};

interface TransferRow {
  id: string;
  date: string;
  created_at: string;
  from_location: string;
  to_location: string;
  stock_item_id: string | null;
  qty: number;
  unit: string;
  note: string | null;
}

export const transfersRepo = {
  async listRecent(limit = 20): Promise<TransferEntry[]> {
    const rows = unwrap(
      await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as TransferRow[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      createdAt: r.created_at,
      fromLocation: r.from_location,
      toLocation: r.to_location,
      stockItemId: r.stock_item_id,
      qty: Number(r.qty),
      unit: r.unit,
      note: r.note,
    }));
  },

  /** Moves stock between locations through the server RPC (ledger + audit). */
  async record(input: {
    fromLocation: string;
    toLocation: string;
    stockItemId: string;
    qty: number;
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_transfer", {
      p_from: input.fromLocation,
      p_to: input.toLocation,
      p_stock_item_id: input.stockItemId,
      p_qty: input.qty,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },
};

export { recordAudit };
