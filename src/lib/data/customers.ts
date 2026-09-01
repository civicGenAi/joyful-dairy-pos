import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { BillingCycle, Customer, CustomerActivity, CustomerType, Unit } from "@/mock/types";

// BACKEND: customers repository. Activities derive from sales + sale_lines,
// deposits from the deposits table, so statements stay ledger-true.

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  type: CustomerType;
  outstanding_tzs: number;
  last_activity: string | null;
  status: "active" | "overdue" | "ok";
  reminders_enabled?: boolean;
  suspended?: boolean;
  next_due_date?: string | null;
  billing_cycle?: BillingCycle;
}

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? "",
    type: r.type,
    outstandingTZS: Number(r.outstanding_tzs),
    lastActivity: r.last_activity ?? "",
    status: r.status,
    remindersEnabled: r.reminders_enabled ?? true,
    suspended: r.suspended ?? false,
    nextDueDate: r.next_due_date ?? undefined,
    billingCycle: r.billing_cycle ?? "month_end",
  };
}

export interface CustomerDeposit {
  id: string;
  date: string;
  amountTZS: number;
  ref: string;
}

export const customerKeys = {
  all: ["customers"] as const,
  list: () => ["customers", "list"] as const,
  byId: (id: string) => ["customers", "byId", id] as const,
  activities: (id: string) => ["customers", "activities", id] as const,
  deposits: (id: string) => ["customers", "deposits", id] as const,
};

export const customersRepo = {
  // A hard cap, not real pagination, see the same note in farmers.ts.
  async list(): Promise<Customer[]> {
    const rows = unwrap(
      await supabase.from("customers").select("*").is("deleted_at", null).order("name").limit(2000),
    ) as CustomerRow[];
    return rows.map(toCustomer);
  },

  async byId(id: string): Promise<Customer> {
    const row = unwrap(
      await supabase.from("customers").select("*").eq("id", id).single(),
    ) as CustomerRow;
    return toCustomer(row);
  },

  /** Sale lines for this customer in the CustomerActivity shape the UI uses. */
  async activities(customerId: string, limit = 60): Promise<CustomerActivity[]> {
    const rows = unwrap(
      await supabase
        .from("sale_lines")
        .select(
          "id, product_id, qty, unit, amount_tzs, sales!inner(id, date, payment, customer_id, voided)",
        )
        .eq("sales.customer_id", customerId)
        .eq("sales.voided", false)
        .order("id", { ascending: false })
        .limit(limit),
    ) as unknown as {
      id: string;
      product_id: string;
      qty: number;
      unit: Unit;
      amount_tzs: number;
      sales: { id: string; date: string; payment: string; customer_id: string; voided: boolean };
    }[];
    return rows
      .map((r) => ({
        id: r.id,
        date: r.sales.date,
        productId: r.product_id,
        qty: Number(r.qty),
        unit: r.unit,
        amountTZS: Number(r.amount_tzs),
        paid: r.sales.payment !== "credit",
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** True running balance as of the start of a given date, computed
   *  server-side from the full ledger. Used as a monthly statement's
   *  opening balance so a debt carried from an earlier month doesn't
   *  silently disappear. */
  async balanceBefore(customerId: string, beforeDate: string): Promise<number> {
    const { data, error } = await supabase.rpc("customer_balance_before", {
      p_customer_id: customerId,
      p_before_date: beforeDate,
    });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  async deposits(customerId: string): Promise<CustomerDeposit[]> {
    const rows = unwrap(
      await supabase
        .from("deposits")
        .select("id, date, amount_tzs, ref")
        .eq("customer_id", customerId)
        .order("date", { ascending: false }),
    ) as { id: string; date: string; amount_tzs: number; ref: string | null }[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      amountTZS: Number(r.amount_tzs),
      ref: r.ref ?? r.id,
    }));
  },

  async create(input: {
    name: string;
    phone: string;
    email?: string;
    type: CustomerType;
    nextDueDate?: string;
    billingCycle?: BillingCycle;
  }): Promise<Customer> {
    const row = unwrap(
      await supabase
        .from("customers")
        .insert({
          name: input.name,
          phone: input.phone,
          email: input.email ?? "",
          type: input.type,
          next_due_date: input.nextDueDate || null,
          billing_cycle: input.billingCycle ?? "month_end",
        })
        .select("*")
        .single(),
    ) as CustomerRow;
    await recordAudit(
      "create",
      "customers",
      `Amesajili mteja mpya (${input.name})`,
      `Registered a new customer (${input.name})`,
    );
    return toCustomer(row);
  },

  async update(input: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    type: CustomerType;
    remindersEnabled?: boolean;
    nextDueDate?: string;
    billingCycle?: BillingCycle;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("customers")
        .update({
          name: input.name,
          phone: input.phone,
          email: input.email ?? "",
          type: input.type,
          reminders_enabled: input.remindersEnabled ?? true,
          next_due_date: input.nextDueDate || null,
          billing_cycle: input.billingCycle ?? "month_end",
        })
        .eq("id", input.id)
        .select("id"),
    );
    await recordAudit(
      "edit",
      "customers",
      `Amehariri taarifa za mteja (${input.name})`,
      `Edited customer details (${input.name})`,
    );
  },

  /** Soft delete: past receipts and statements for this customer stay
   *  attributed instead of going anonymous. Restore from Settings -> Trash. */
  async remove(id: string, name: string): Promise<void> {
    unwrap(
      await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id"),
    );
    await recordAudit(
      "delete",
      "customers",
      `Amefuta mteja (${name})`,
      `Deleted customer (${name})`,
    );
  },

  /** Customer payment against their balance. Via RPC (outstanding + audit). */
  async recordDeposit(input: {
    customerId: string;
    amountTZS: number;
    method: "cash" | "mpesa" | "bank";
    attachmentUrl?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_deposit", {
      p_source: "customer",
      p_method: input.method,
      p_amount: input.amountTZS,
      p_customer_id: input.customerId,
      p_attachment_url: input.attachmentUrl ?? null,
    });
    if (error) throw new Error(error.message);
  },
};

// Suspension + automatic reminders (email via the send-reminder edge function).
export const customerExtrasRepo = {
  async setSuspended(id: string, name: string, suspended: boolean): Promise<void> {
    unwrap(await supabase.from("customers").update({ suspended }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "customers",
      suspended ? `Amemsimamisha mteja (${name})` : `Amemrudisha mteja (${name})`,
      suspended ? `Suspended customer (${name})` : `Reinstated customer (${name})`,
    );
  },

  /** Send a balance reminder email now (one customer, or all when omitted). */
  async sendReminder(customerId?: string): Promise<{ sent: { id: string; status: string }[] }> {
    const { data, error } = await supabase.functions.invoke("send-reminder", {
      body: customerId ? { customerId } : {},
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
    return data as { sent: { id: string; status: string }[] };
  },
};
