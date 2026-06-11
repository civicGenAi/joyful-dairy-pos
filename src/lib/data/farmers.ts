import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { Farmer } from "@/mock/types";

// BACKEND: farmers repository. Replaces direct FARMERS imports from @/mock/data.

interface FarmerRow {
  id: string;
  name: string;
  phone: string;
  village: string;
  rate_per_l: number;
  current_balance_tzs: number;
  last_payment_tzs: number;
  last_payment_date: string | null;
  status: Farmer["status"];
  litres_this_cycle: number;
}

function toFarmer(r: FarmerRow): Farmer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    village: r.village,
    litresThisCycle: Number(r.litres_this_cycle ?? 0),
    ratePerL: Number(r.rate_per_l),
    lastPaymentTZS: Number(r.last_payment_tzs),
    lastPaymentDate: r.last_payment_date ?? "",
    currentBalanceTZS: Number(r.current_balance_tzs),
    status: r.status,
  };
}

export interface PayoutEntry {
  id: string;
  date: string;
  amountTZS: number;
  method: string;
  ref: string | null;
}

export const farmerKeys = {
  all: ["farmers"] as const,
  list: () => ["farmers", "list"] as const,
  byId: (id: string) => ["farmers", "byId", id] as const,
  payouts: (id: string) => ["farmers", "payouts", id] as const,
  cycle: () => ["farmers", "cycle"] as const,
};

export interface CycleSummary {
  startDate: string;
  endDate: string;
  status: "open" | "paying" | "closed";
  daysElapsed: number;
  daysTotal: number;
  paidTZS: number;
}

export const farmersRepo = {
  async list(): Promise<Farmer[]> {
    const rows = unwrap(
      await supabase.from("farmers_view").select("*").order("name"),
    ) as FarmerRow[];
    return rows.map(toFarmer);
  },

  async byId(id: string): Promise<Farmer> {
    const row = unwrap(
      await supabase.from("farmers_view").select("*").eq("id", id).single(),
    ) as FarmerRow;
    return toFarmer(row);
  },

  async create(input: {
    name: string;
    phone: string;
    village: string;
    ratePerL: number;
  }): Promise<Farmer> {
    const row = unwrap(
      await supabase
        .from("farmers")
        .insert({
          name: input.name,
          phone: input.phone,
          village: input.village,
          rate_per_l: input.ratePerL,
        })
        .select("*")
        .single(),
    ) as Omit<FarmerRow, "litres_this_cycle">;
    await recordAudit(
      "create",
      "farmers",
      `Amesajili mfugaji mpya (${input.name})`,
      `Registered a new farmer (${input.name})`,
    );
    return toFarmer({ ...row, litres_this_cycle: 0 });
  },

  async update(input: {
    id: string;
    name: string;
    phone: string;
    village: string;
    ratePerL: number;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("farmers")
        .update({
          name: input.name,
          phone: input.phone,
          village: input.village,
          rate_per_l: input.ratePerL,
        })
        .eq("id", input.id)
        .select("id"),
    );
    await recordAudit(
      "edit",
      "farmers",
      `Amehariri taarifa za mfugaji (${input.name})`,
      `Edited farmer details (${input.name})`,
    );
  },

  async remove(id: string, name: string): Promise<void> {
    unwrap(await supabase.from("farmers").delete().eq("id", id).select("id"));
    await recordAudit("delete", "farmers", `Amefuta mfugaji (${name})`, `Deleted farmer (${name})`);
  },

  /** Pays a farmer against their accrued balance. Audited server-side. */
  async pay(input: {
    farmerId: string;
    amountTZS: number;
    method: "cash" | "mpesa" | "bank";
    ref?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_payout", {
      p_farmer_id: input.farmerId,
      p_amount: input.amountTZS,
      p_method: input.method,
      p_ref: input.ref ?? null,
    });
    if (error) throw new Error(error.message);
  },

  /** The open 15-day payout cycle plus what has already been paid inside it. */
  async cycleSummary(): Promise<CycleSummary | null> {
    const { data: cycle, error } = await supabase
      .from("cycles")
      .select("*")
      .in("status", ["open", "paying"])
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cycle) return null;
    const { data: paid, error: paidErr } = await supabase
      .from("payouts")
      .select("amount_tzs")
      .eq("cycle_id", cycle.id);
    if (paidErr) throw new Error(paidErr.message);
    const start = new Date(`${cycle.start_date}T00:00:00`);
    const end = new Date(`${cycle.end_date}T00:00:00`);
    const daysTotal = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const daysElapsed = Math.min(
      Math.max(Math.round((Date.now() - start.getTime()) / 86_400_000) + 1, 0),
      daysTotal,
    );
    return {
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      status: cycle.status,
      daysElapsed,
      daysTotal,
      paidTZS: (paid ?? []).reduce((a, r) => a + Number(r.amount_tzs), 0),
    };
  },

  async payouts(farmerId: string): Promise<PayoutEntry[]> {
    const rows = unwrap(
      await supabase
        .from("payouts")
        .select("id, date, amount_tzs, method, ref")
        .eq("farmer_id", farmerId)
        .order("date", { ascending: false })
        .limit(12),
    ) as { id: string; date: string; amount_tzs: number; method: string; ref: string | null }[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      amountTZS: Number(r.amount_tzs),
      method: r.method,
      ref: r.ref,
    }));
  },
};
