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
  adjustments: () => ["farmers", "adjustments"] as const,
  monthly: (id: string, months: number) => ["farmers", "monthly", id, months] as const,
};

export interface FarmerAdjustment {
  id: string;
  farmerId: string;
  farmerName?: string;
  deltaTZS: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedByName?: string;
  requestedAt: string;
  reviewedByName?: string;
  reviewedAt: string | null;
}

export interface CycleSummary {
  startDate: string;
  endDate: string;
  status: "open" | "paying" | "closed";
  daysElapsed: number;
  daysTotal: number;
  paidTZS: number;
}

export interface FarmerMonth {
  month: string;
  litres: number;
  earnedTZS: number;
  paidTZS: number;
  status: "paid" | "partial" | "unpaid" | "none";
}

export const farmersRepo = {
  // A hard cap, not real pagination: keeps a single accidental full-table
  // scan from ever pulling an unbounded result set as the roster grows.
  // Screens beyond this size need a real paged UI, not just a bigger limit.
  async list(): Promise<Farmer[]> {
    const rows = unwrap(
      await supabase
        .from("farmers_view")
        .select("*")
        .is("deleted_at", null)
        .order("name")
        .limit(2000),
    ) as FarmerRow[];
    return rows.map(toFarmer);
  },

  // Deliberately not filtered on deleted_at: statement and payout-slip print
  // routes look a farmer up by id long after they may have been removed,
  // and should keep resolving.
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

  /** Soft delete: the farmer drops out of every list but their collection
   *  and payout history stays intact for already-reconciled days. Restore
   *  from Settings -> Trash. */
  async remove(id: string, name: string): Promise<void> {
    unwrap(
      await supabase
        .from("farmers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id"),
    );
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

  /** Litres, amount earned, amount paid and a Paid/Partial/Unpaid status
   *  per calendar month, so a gap in payment history is visible at a
   *  glance instead of only ever showing the current 15-day cycle. */
  async monthlySummary(farmerId: string, months = 12): Promise<FarmerMonth[]> {
    const { data, error } = await supabase.rpc("farmer_monthly_summary", {
      p_farmer_id: farmerId,
      p_months: months,
    });
    if (error) throw new Error(error.message);
    return (
      data as {
        month: string;
        litres: number;
        earned_tzs: number;
        paid_tzs: number;
        status: FarmerMonth["status"];
      }[]
    ).map((r) => ({
      month: r.month,
      litres: Number(r.litres),
      earnedTZS: Number(r.earned_tzs),
      paidTZS: Number(r.paid_tzs),
      status: r.status,
    }));
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

// Manual balance adjustments: requested by staff, applied on admin approval.
export const farmerAdjustmentsRepo = {
  async list(limit = 30): Promise<FarmerAdjustment[]> {
    const rows = unwrap(
      await supabase
        .from("farmer_adjustments")
        .select(
          "id, farmer_id, delta_tzs, reason, status, requested_at, reviewed_at, " +
            "farmers(name), requested_by_profile:profiles!farmer_adjustments_requested_by_fkey(name), " +
            "reviewed_by_profile:profiles!farmer_adjustments_reviewed_by_fkey(name)",
        )
        .order("requested_at", { ascending: false })
        .limit(limit),
    ) as unknown as {
      id: string;
      farmer_id: string;
      delta_tzs: number;
      reason: string;
      status: "pending" | "approved" | "rejected";
      requested_at: string;
      reviewed_at: string | null;
      farmers: { name: string } | null;
      requested_by_profile: { name: string } | null;
      reviewed_by_profile: { name: string } | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      farmerId: r.farmer_id,
      farmerName: r.farmers?.name,
      deltaTZS: Number(r.delta_tzs),
      reason: r.reason,
      status: r.status,
      requestedByName: r.requested_by_profile?.name,
      requestedAt: r.requested_at,
      reviewedByName: r.reviewed_by_profile?.name,
      reviewedAt: r.reviewed_at,
    }));
  },

  async request(input: { farmerId: string; deltaTZS: number; reason: string }): Promise<void> {
    const { error } = await supabase.rpc("request_farmer_adjustment", {
      p_farmer_id: input.farmerId,
      p_delta: input.deltaTZS,
      p_reason: input.reason,
    });
    if (error) throw new Error(error.message);
  },

  async review(adjustmentId: string, approve: boolean): Promise<void> {
    const { error } = await supabase.rpc("review_farmer_adjustment", {
      p_adjustment_id: adjustmentId,
      p_approve: approve,
    });
    if (error) throw new Error(error.message);
  },
};
