import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: the fixed-asset register. Buying something that lasts is not an
// expense, it is swapping cash for an asset; the expense is the value it
// loses each month. fa_* RPCs own that arithmetic so the schedule on screen
// and the depreciation posted to the ledger can never disagree.

export interface FixedAsset {
  id: string;
  name: string;
  swName: string;
  category: string;
  costTZS: number;
  acquiredOn: string;
  inServiceOn: string;
  usefulLifeMonths: number;
  salvageTZS: number;
  site: string | null;
  disposedOn: string | null;
  note: string | null;
}

export interface AssetScheduleRow {
  id: string;
  name: string;
  swName: string;
  site: string | null;
  costTZS: number;
  inServiceOn: string;
  usefulLifeMonths: number;
  chargeTZS: number;
  accumulatedTZS: number;
  bookValueTZS: number;
}

interface AssetRow {
  id: string;
  name: string;
  sw_name: string;
  category: string;
  cost_tzs: number;
  acquired_on: string;
  in_service_on: string;
  useful_life_months: number;
  salvage_tzs: number;
  site: string | null;
  disposed_on: string | null;
  note: string | null;
}

function toAsset(r: AssetRow): FixedAsset {
  return {
    id: r.id,
    name: r.name,
    swName: r.sw_name,
    category: r.category,
    costTZS: Number(r.cost_tzs),
    acquiredOn: r.acquired_on,
    inServiceOn: r.in_service_on,
    usefulLifeMonths: r.useful_life_months,
    salvageTZS: Number(r.salvage_tzs),
    site: r.site,
    disposedOn: r.disposed_on,
    note: r.note,
  };
}

export const assetKeys = {
  all: ["assets"] as const,
  list: () => ["assets", "list"] as const,
  schedule: (month: string) => ["assets", "schedule", month] as const,
};

export const assetsRepo = {
  async list(): Promise<FixedAsset[]> {
    const rows = unwrap(
      await supabase
        .from("fixed_assets")
        .select("*")
        .is("deleted_at", null)
        .order("in_service_on", { ascending: false }),
    ) as AssetRow[];
    return rows.map(toAsset);
  },

  async schedule(month: string): Promise<AssetScheduleRow[]> {
    const { data, error } = await supabase.rpc("fa_schedule", { p_month: month });
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        name: string;
        sw_name: string;
        site: string | null;
        cost_tzs: number;
        in_service_on: string;
        useful_life_months: number;
        charge_tzs: number;
        accumulated_tzs: number;
        book_value_tzs: number;
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      swName: r.sw_name,
      site: r.site,
      costTZS: Number(r.cost_tzs),
      inServiceOn: r.in_service_on,
      usefulLifeMonths: r.useful_life_months,
      chargeTZS: Number(r.charge_tzs),
      accumulatedTZS: Number(r.accumulated_tzs),
      bookValueTZS: Number(r.book_value_tzs),
    }));
  },

  async create(input: {
    name: string;
    swName: string;
    category: string;
    costTZS: number;
    acquiredOn: string;
    inServiceOn: string;
    usefulLifeMonths: number;
    salvageTZS: number;
    site?: string;
    note?: string;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("fixed_assets")
        .insert({
          name: input.name,
          sw_name: input.swName || input.name,
          category: input.category,
          cost_tzs: input.costTZS,
          acquired_on: input.acquiredOn,
          in_service_on: input.inServiceOn,
          useful_life_months: input.usefulLifeMonths,
          salvage_tzs: input.salvageTZS,
          site: input.site ?? null,
          note: input.note ?? null,
        })
        .select("id"),
    );
  },

  /** Posts one month's depreciation. Keyed by month, so a second run for
   *  the same month posts nothing rather than charging it twice. */
  async postDepreciation(month: string): Promise<{ posted: number; amount: number }> {
    const { data, error } = await supabase.rpc("fa_post_depreciation", { p_month: month });
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    return { posted: Number(r.posted ?? 0), amount: Number(r.amount ?? 0) };
  },
};
