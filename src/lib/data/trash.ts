import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";

// BACKEND: trash bin repository. Every soft-deleted farmer, customer,
// product, location, stock item and expense can be listed and restored
// here. Restore is a plain update (clears deleted_at) through the same
// *:write RLS policy that could edit the row in the first place.

export type TrashEntity = "farmer" | "customer" | "product" | "location" | "stock-item" | "expense";

export interface TrashEntry {
  entity: TrashEntity;
  id: string;
  name: string;
  deletedAt: string;
}

const TABLE_BY_ENTITY: Record<TrashEntity, string> = {
  farmer: "farmers",
  customer: "customers",
  product: "products",
  location: "locations",
  "stock-item": "stock_items",
  expense: "expenses",
};

const MODULE_BY_ENTITY: Record<
  TrashEntity,
  "farmers" | "customers" | "products" | "settings" | "stock" | "finance"
> = {
  farmer: "farmers",
  customer: "customers",
  product: "products",
  location: "settings",
  "stock-item": "stock",
  expense: "finance",
};

const RESTORE_LABEL: Record<TrashEntity, { sw: string; en: string }> = {
  farmer: { sw: "Amerudisha mfugaji", en: "Restored farmer" },
  customer: { sw: "Amerudisha mteja", en: "Restored customer" },
  product: { sw: "Amerudisha bidhaa", en: "Restored product" },
  location: { sw: "Amerudisha eneo", en: "Restored location" },
  "stock-item": { sw: "Amerudisha bidhaa ghalani", en: "Restored store item" },
  expense: { sw: "Amerudisha matumizi", en: "Restored expense" },
};

export const trashKeys = {
  all: ["trash"] as const,
  list: () => ["trash", "list"] as const,
};

export const trashRepo = {
  async list(): Promise<TrashEntry[]> {
    const rows = unwrap(await supabase.rpc("trash_list")) as {
      entity: TrashEntity;
      id: string;
      name: string;
      deleted_at: string;
    }[];
    return rows.map((r) => ({ entity: r.entity, id: r.id, name: r.name, deletedAt: r.deleted_at }));
  },

  async restore(entry: Pick<TrashEntry, "entity" | "id" | "name">): Promise<void> {
    unwrap(
      await supabase
        .from(TABLE_BY_ENTITY[entry.entity])
        .update({ deleted_at: null })
        .eq("id", entry.id)
        .select("id"),
    );
    const label = RESTORE_LABEL[entry.entity];
    await recordAudit(
      "restore",
      MODULE_BY_ENTITY[entry.entity],
      `${label.sw} (${entry.name})`,
      `${label.en} (${entry.name})`,
    );
  },

  /** Permanently removes soft-deleted rows past the retention window, but
   *  only ones with zero ledger history. Admin only. */
  async purge(olderThanDays = 30): Promise<Record<string, number>> {
    const { data, error } = await supabase.rpc("purge_trash", { p_older_than_days: olderThanDays });
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  },
};
