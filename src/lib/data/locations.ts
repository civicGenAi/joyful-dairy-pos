import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { Location, LocationKind } from "@/mock/data";

// BACKEND: locations repository. Replaces the LOCATIONS import from @/mock/data.

interface LocationRow {
  id: string;
  name: string;
  sw_name: string;
  kind: LocationKind;
  note: string | null;
  active: boolean;
}

function toLocation(r: LocationRow): Location {
  return {
    id: r.id,
    name: r.name,
    swName: r.sw_name,
    kind: r.kind,
    note: r.note ?? undefined,
    active: r.active,
  };
}

export const locationKeys = {
  all: ["locations"] as const,
  list: () => ["locations", "list"] as const,
};

export const locationsRepo = {
  async list(): Promise<Location[]> {
    const rows = unwrap(
      await supabase.from("locations").select("*").is("deleted_at", null).order("name"),
    ) as LocationRow[];
    return rows.map(toLocation);
  },

  async create(input: {
    name: string;
    swName: string;
    kind: LocationKind;
    note?: string;
  }): Promise<Location> {
    const row = unwrap(
      await supabase
        .from("locations")
        .insert({ name: input.name, sw_name: input.swName, kind: input.kind, note: input.note })
        .select("*")
        .single(),
    ) as LocationRow;
    await recordAudit(
      "create",
      "settings",
      `Ameongeza eneo jipya (${input.name})`,
      `Added a new location (${input.name})`,
    );
    return toLocation(row);
  },

  async update(input: { id: string; name: string; swName: string; note?: string }): Promise<void> {
    unwrap(
      await supabase
        .from("locations")
        .update({ name: input.name, sw_name: input.swName, note: input.note ?? null })
        .eq("id", input.id)
        .select("id"),
    );
    await recordAudit(
      "edit",
      "settings",
      `Amehariri eneo (${input.name})`,
      `Edited location (${input.name})`,
    );
  },

  async setActive(id: string, name: string, active: boolean): Promise<void> {
    unwrap(await supabase.from("locations").update({ active }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "settings",
      active ? `Amewasha eneo (${name})` : `Amezima eneo (${name})`,
      active ? `Activated location (${name})` : `Deactivated location (${name})`,
    );
  },

  /** Soft delete: past movements/collections/sales at this location stay
   *  attributed. Restore from Settings -> Trash. */
  async remove(id: string, name: string): Promise<void> {
    unwrap(
      await supabase
        .from("locations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id"),
    );
    await recordAudit("delete", "settings", `Amefuta eneo (${name})`, `Deleted location (${name})`);
  },
};
