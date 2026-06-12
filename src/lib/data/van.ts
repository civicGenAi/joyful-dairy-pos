import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";

// BACKEND: persisted van loads (migration 00008). The Load tab saves what the
// driver actually has on the van; Sell and Returns derive from these rows, so
// a reload or a different device sees the same truth.

export interface VanLoadLine {
  id: string;
  date: string;
  locationId: string;
  productId: string;
  qty: number;
}

interface VanLoadRow {
  id: string;
  date: string;
  location_id: string;
  product_id: string;
  qty: number;
}

export const vanKeys = {
  all: ["van"] as const,
  loads: (date: string, locationId: string) => ["van", "loads", date, locationId] as const,
};

export const vanRepo = {
  /** The confirmed load for a day; empty array means not loaded yet. */
  async loads(date: string, locationId = "loc-van1"): Promise<VanLoadLine[]> {
    const rows = unwrap(
      await supabase
        .from("van_loads")
        .select("*")
        .eq("date", date)
        .eq("location_id", locationId)
        .order("created_at"),
    ) as VanLoadRow[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      locationId: r.location_id,
      productId: r.product_id,
      qty: Number(r.qty),
    }));
  },

  /** Saves the confirmed load lines (only the products the driver selected). */
  async saveLoad(input: {
    date: string;
    locationId?: string;
    lines: { productId: string; qty: number }[];
  }): Promise<void> {
    const { data: me } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", me.user?.id ?? "")
      .maybeSingle();
    const locationId = input.locationId ?? "loc-van1";
    unwrap(
      await supabase
        .from("van_loads")
        .upsert(
          input.lines.map((l) => ({
            date: input.date,
            location_id: locationId,
            product_id: l.productId,
            qty: l.qty,
            loaded_by: profile?.id ?? null,
          })),
          { onConflict: "date,location_id,product_id" },
        )
        .select("id"),
    );
    await recordAudit(
      "create",
      "stock",
      `Amethibitisha upakiaji wa gari, bidhaa ${input.lines.length}`,
      `Confirmed the van load, ${input.lines.length} products`,
    );
  },
};
