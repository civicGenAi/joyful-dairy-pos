import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { Expense, ExpenseCategory } from "@/mock/data";

// BACKEND: finance repository: cash position, payout runs, expenses.
// Receivables come from customersRepo, payables from farmersRepo,
// the deposits log from depositsRepo (src/lib/data/sales.ts).

export interface CashPosition {
  counterCash: number;
  counterMpesa: number;
  routeCash: number;
  routeMpesa: number;
  depositsToday: number;
  total: number;
}

export const financeKeys = {
  all: ["finance"] as const,
  cash: (date: string) => ["finance", "cash", date] as const,
  expenses: () => ["finance", "expenses"] as const,
};

export const financeRepo = {
  /** Cash position for a date, rolled up from sales + deposits. */
  async cashPosition(date: string): Promise<CashPosition> {
    const sales = unwrap(
      await supabase
        .from("sales")
        .select("channel, payment, total_tzs")
        .eq("date", date)
        .eq("voided", false),
    ) as { channel: "counter" | "route"; payment: string; total_tzs: number }[];
    const deposits = unwrap(
      await supabase.from("deposits").select("amount_tzs").eq("date", date),
    ) as { amount_tzs: number }[];
    const sum = (ch: string, pay: string) =>
      sales
        .filter((s) => s.channel === ch && s.payment === pay)
        .reduce((a, s) => a + Number(s.total_tzs), 0);
    const pos: CashPosition = {
      counterCash: sum("counter", "cash"),
      counterMpesa: sum("counter", "mpesa"),
      routeCash: sum("route", "cash"),
      routeMpesa: sum("route", "mpesa"),
      depositsToday: deposits.reduce((a, d) => a + Number(d.amount_tzs), 0),
      total: 0,
    };
    pos.total = pos.counterCash + pos.counterMpesa + pos.routeCash + pos.routeMpesa;
    return pos;
  },

  /** Pays every farmer with a balance in the open cycle, then rolls the cycle. */
  async initiatePayouts(method: "cash" | "mpesa" | "bank"): Promise<void> {
    const { error } = await supabase.rpc("initiate_payouts", { p_method: method });
    if (error) throw new Error(error.message);
  },
};

// --- Expenses ---------------------------------------------------------------

export type ExpenseWithRefs = Expense & {
  refNo?: string;
  invoiceRef?: string;
  attachmentUrl?: string;
};

interface ExpenseRow {
  id: string;
  date: string;
  category: ExpenseCategory;
  site?: string | null;
  vendor: string;
  description: string;
  amount_tzs: number;
  method: "cash" | "mpesa" | "bank";
  ref: string | null;
  ref_no?: string | null;
  invoice_ref?: string | null;
  attachment_url?: string | null;
  profiles?: { name: string } | null;
}

function toExpense(r: ExpenseRow): ExpenseWithRefs {
  return {
    id: r.id,
    date: r.date,
    category: r.category,
    // Null on rows recorded before sites existed, they group under
    // "Unassigned" rather than being guessed into a real site's total.
    site: r.site ?? undefined,
    vendor: r.vendor,
    description: r.description,
    amountTZS: Number(r.amount_tzs),
    method: r.method,
    ref: r.ref ?? undefined,
    refNo: r.ref_no ?? undefined,
    invoiceRef: r.invoice_ref ?? undefined,
    attachmentUrl: r.attachment_url ?? undefined,
    recordedBy: r.profiles?.name ?? "",
  };
}

export const expenseCategoriesRepo = {
  async list(): Promise<string[]> {
    const rows = unwrap(await supabase.from("expense_categories").select("name").order("name")) as {
      name: string;
    }[];
    return rows.map((r) => r.name);
  },

  /** Adds a new category so it's offered again next time. Safe to call
   *  with an already-existing name, just does nothing.
   *
   *  ignoreDuplicates makes this ON CONFLICT DO NOTHING rather than DO
   *  UPDATE. That is what we mean, and it is also the only form that works:
   *  the table has select and insert policies but no update policy, so the
   *  DO UPDATE path is refused by RLS the moment the name already exists,
   *  which used to take the whole expense save down with it. */
  async create(name: string): Promise<void> {
    unwrap(
      await supabase
        .from("expense_categories")
        .upsert({ name }, { onConflict: "name", ignoreDuplicates: true }),
    );
  },
};

// Which part of the business an expense belongs to: Kiwanda (main plant),
// Madam (the owner's own), Shamba (the farm). An open set, so another site
// can be added by typing it once.
export const expenseSitesRepo = {
  async list(): Promise<string[]> {
    const rows = unwrap(await supabase.from("expense_sites").select("name").order("name")) as {
      name: string;
    }[];
    return rows.map((r) => r.name);
  },

  /** Safe to call with an already-existing name, just does nothing. */
  async create(name: string): Promise<void> {
    unwrap(
      await supabase
        .from("expense_sites")
        .upsert({ name }, { onConflict: "name", ignoreDuplicates: true }),
    );
  },
};

export const expensesRepo = {
  async list(limit = 100): Promise<ExpenseWithRefs[]> {
    const rows = unwrap(
      await supabase
        .from("expenses")
        .select("*, profiles(name)")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as ExpenseRow[];
    return rows.map(toExpense);
  },

  async create(input: {
    date: string;
    category: ExpenseCategory;
    site?: string;
    vendor: string;
    description: string;
    amountTZS: number;
    method: "cash" | "mpesa" | "bank";
    ref?: string;
    invoiceRef?: string;
    attachmentUrl?: string;
  }): Promise<void> {
    const { data: me } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", me.user?.id ?? "")
      .maybeSingle();
    // Remembers a newly-typed category/site for next time, a no-op if it
    // already exists.
    await expenseCategoriesRepo.create(input.category);
    if (input.site) await expenseSitesRepo.create(input.site);
    unwrap(
      await supabase
        .from("expenses")
        .insert({
          date: input.date,
          category: input.category,
          site: input.site ?? null,
          vendor: input.vendor,
          description: input.description,
          amount_tzs: input.amountTZS,
          method: input.method,
          ref: input.ref ?? null,
          invoice_ref: input.invoiceRef ?? null,
          attachment_url: input.attachmentUrl ?? null,
          recorded_by: profile?.id ?? null,
        })
        .select("id"),
    );
    await recordAudit(
      "create",
      "finance",
      `Amerekodi matumizi TZS ${input.amountTZS} (${input.vendor})`,
      `Recorded expense TZS ${input.amountTZS} (${input.vendor})`,
    );
  },

  /** Corrects an expense in place. Deleting and retyping would lose the
   *  system reference the paperwork was filed under, and the ledger entry
   *  is reversed so the corrected figures post fresh. */
  async update(input: {
    id: string;
    date: string;
    category: string;
    site?: string;
    vendor: string;
    description: string;
    amountTZS: number;
    method: "cash" | "mpesa" | "bank";
    invoiceRef?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("update_expense", {
      p_id: input.id,
      p_date: input.date,
      p_category: input.category,
      p_site: input.site ?? null,
      p_vendor: input.vendor,
      p_description: input.description,
      p_amount: input.amountTZS,
      p_method: input.method,
      p_invoice_ref: input.invoiceRef ?? null,
    });
    if (error) throw new Error(error.message);
  },

  /** Soft delete. Restore from Settings -> Trash. */
  async remove(id: string, vendor: string): Promise<void> {
    unwrap(
      await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id"),
    );
    await recordAudit(
      "delete",
      "finance",
      `Amefuta matumizi (${vendor})`,
      `Deleted expense (${vendor})`,
    );
  },
};
