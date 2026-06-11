import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: reconciliation repository. The conservation check is authoritative
// server-side in the lock_day RPC; this layer only reads rollups and locks.

export interface ReconRow {
  productId: string;
  product: string;
  unit: string;
  opening: number;
  collected: number;
  produced: number;
  soldCash: number;
  soldCredit: number;
  separated: number;
  spoilt: number;
  returned: number;
  closing: number;
}

export interface DayLock {
  date: string;
  rows: ReconRow[];
  lockedByName?: string;
  lockedAt: string;
  confirmedByName?: string;
  confirmedAt: string | null;
}

export const reconKeys = {
  all: ["recon"] as const,
  forDate: (date: string) => ["recon", "forDate", date] as const,
  locks: () => ["recon", "locks"] as const,
};

interface ReconRpcRow {
  product_id: string;
  product: string;
  unit: string;
  opening: number;
  collected: number;
  produced: number;
  sold_cash: number;
  sold_credit: number;
  separated: number;
  spoilt: number;
  returned: number;
  closing: number;
}

function toRow(r: ReconRpcRow): ReconRow {
  return {
    productId: r.product_id,
    product: r.product,
    unit: r.unit,
    opening: Number(r.opening),
    collected: Number(r.collected),
    produced: Number(r.produced),
    soldCash: Number(r.sold_cash),
    soldCredit: Number(r.sold_credit),
    separated: Number(r.separated),
    spoilt: Number(r.spoilt),
    returned: Number(r.returned),
    closing: Number(r.closing),
  };
}

interface LockedRowJson {
  product_id: string;
  product: string;
  unit: string;
  opening: number;
  collected: number;
  produced: number;
  soldCash: number;
  soldCredit: number;
  separated: number;
  spoilt: number;
  returned: number;
  closing: number;
}

interface DayLockRow {
  date: string;
  rows: LockedRowJson[];
  locked_at: string;
  confirmed_at: string | null;
  locked_by_profile?: { name: string } | null;
  confirmed_by_profile?: { name: string } | null;
}

function toLock(r: DayLockRow): DayLock {
  return {
    date: r.date,
    rows: (r.rows ?? []).map((x) => ({
      productId: x.product_id,
      product: x.product,
      unit: x.unit,
      opening: Number(x.opening),
      collected: Number(x.collected),
      produced: Number(x.produced),
      soldCash: Number(x.soldCash),
      soldCredit: Number(x.soldCredit),
      separated: Number(x.separated),
      spoilt: Number(x.spoilt),
      returned: Number(x.returned),
      closing: Number(x.closing),
    })),
    lockedByName: r.locked_by_profile?.name,
    lockedAt: r.locked_at,
    confirmedByName: r.confirmed_by_profile?.name,
    confirmedAt: r.confirmed_at,
  };
}

const LOCK_SELECT =
  "date, rows, locked_at, confirmed_at, locked_by_profile:profiles!day_locks_locked_by_fkey(name), confirmed_by_profile:profiles!day_locks_confirmed_by_fkey(name)";

export const reconRepo = {
  /** Live conservation table for a date, rolled up from the movement ledger. */
  async forDate(date: string): Promise<ReconRow[]> {
    const { data, error } = await supabase.rpc("recon_for_date", { p_date: date });
    if (error) throw new Error(error.message);
    return (data as ReconRpcRow[]).map(toRow);
  },

  async lockForDate(date: string): Promise<DayLock | null> {
    const { data, error } = await supabase
      .from("day_locks")
      .select(LOCK_SELECT)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toLock(data as unknown as DayLockRow) : null;
  },

  async locks(limit = 14): Promise<DayLock[]> {
    const rows = unwrap(
      await supabase
        .from("day_locks")
        .select(LOCK_SELECT)
        .order("date", { ascending: false })
        .limit(limit),
    ) as unknown as DayLockRow[];
    return rows.map(toLock);
  },

  /**
   * Locks the day. The server re-computes the rollup and rejects when any
   * product is out of balance beyond 0.05. Optional physical counts override
   * the computed closings.
   */
  async lockDay(date: string, physical?: { productId: string; closing: number }[]): Promise<void> {
    const { error } = await supabase.rpc("lock_day", {
      p_date: date,
      p_physical: physical
        ? physical.map((p) => ({ product_id: p.productId, closing: p.closing }))
        : null,
    });
    if (error) throw new Error(error.message);
  },

  async confirmDay(date: string): Promise<void> {
    const { error } = await supabase.rpc("confirm_day", { p_date: date });
    if (error) throw new Error(error.message);
  },
};
