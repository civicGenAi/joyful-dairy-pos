import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: invoices repository. An invoice is issued (not computed live)
// via issue_order_invoice / issue_bill_invoice, so a customer's printed
// copy stays accurate even if later activity would change what a live
// recompute shows. verify_invoice() is the one public RPC in the app,
// backing the QR authenticity check, see 00019_invoices.sql for why.

export interface InvoiceLine {
  date: string;
  activity: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  kind: "order" | "bill";
  customerId: string;
  saleId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingTZS: number;
  takingsTZS: number;
  depositsTZS: number;
  /** A one-off amount owed from before this system tracked the customer's
   *  activity, entered manually at issue time, shown as its own line at
   *  the bottom of the invoice. Does not affect the customer's balance
   *  anywhere else in the app, only this specific invoice. */
  arrearsTZS: number;
  arrearsNote: string | null;
  balanceDueTZS: number;
  termsDays: number;
  dueDate: string;
  lines: InvoiceLine[];
  issuedAt: string;
  customerName?: string;
}

interface InvoiceRow {
  id: string;
  kind: "order" | "bill";
  customer_id: string;
  sale_id: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_tzs: number;
  takings_tzs: number;
  deposits_tzs: number;
  arrears_tzs: number;
  arrears_note: string | null;
  balance_due_tzs: number;
  terms_days: number;
  due_date: string;
  lines_snapshot: InvoiceLine[];
  issued_at: string;
  customers?: { name: string } | null;
}

function toInvoice(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    kind: r.kind,
    customerId: r.customer_id,
    saleId: r.sale_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    openingTZS: Number(r.opening_tzs),
    takingsTZS: Number(r.takings_tzs),
    depositsTZS: Number(r.deposits_tzs),
    arrearsTZS: Number(r.arrears_tzs ?? 0),
    arrearsNote: r.arrears_note ?? null,
    balanceDueTZS: Number(r.balance_due_tzs),
    termsDays: r.terms_days,
    dueDate: r.due_date,
    lines: r.lines_snapshot ?? [],
    issuedAt: r.issued_at,
    customerName: r.customers?.name,
  };
}

export interface InvoiceVerification {
  found: boolean;
  invoiceId?: string;
  kind?: "order" | "bill";
  issuedAt?: string;
  dueDate?: string;
  amountTZS?: number;
  issuer?: string;
  issuerCity?: string;
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  byId: (id: string) => ["invoices", "byId", id] as const,
  byCustomer: (customerId: string) => ["invoices", "byCustomer", customerId] as const,
};

export const invoicesRepo = {
  async byId(id: string): Promise<Invoice> {
    const row = unwrap(
      await supabase.from("invoices").select("*, customers(name)").eq("id", id).single(),
    ) as InvoiceRow;
    return toInvoice(row);
  },

  async byCustomer(customerId: string, limit = 20): Promise<Invoice[]> {
    const rows = unwrap(
      await supabase
        .from("invoices")
        .select("*, customers(name)")
        .eq("customer_id", customerId)
        .order("issued_at", { ascending: false })
        .limit(limit),
    ) as InvoiceRow[];
    return rows.map(toInvoice);
  },

  /** Turns one sale into a formal invoice: a named customer only, a
   *  receipt already covers a walk-in sale. */
  async issueOrderInvoice(saleId: string, termsDays = 30): Promise<Invoice> {
    const { data, error } = await supabase.rpc("issue_order_invoice", {
      p_sale_id: saleId,
      p_terms_days: termsDays,
    });
    if (error) throw new Error(error.message);
    return toInvoice(data as InvoiceRow);
  },

  /** Issues a numbered bill for a customer's activity in one period
   *  (opening balance, that period's takings and deposits, balance due). */
  async issueBillInvoice(input: {
    customerId: string;
    periodStart: string;
    periodEnd: string;
    termsDays?: number;
    /** One-off arrears line, this invoice only, see the note on Invoice.arrearsTZS. */
    arrearsTZS?: number;
    arrearsNote?: string;
  }): Promise<Invoice> {
    const { data, error } = await supabase.rpc("issue_bill_invoice", {
      p_customer_id: input.customerId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_terms_days: input.termsDays ?? 30,
      p_arrears_tzs: input.arrearsTZS ?? 0,
      p_arrears_note: input.arrearsNote ?? null,
    });
    if (error) throw new Error(error.message);
    return toInvoice(data as InvoiceRow);
  },

  /** Public: looks an invoice up by id and returns only enough to confirm
   *  it's genuine, no auth, this is what the QR code opens. */
  async verify(id: string): Promise<InvoiceVerification> {
    const { data, error } = await supabase.rpc("verify_invoice", { p_invoice_id: id });
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    if (!r.found) return { found: false };
    return {
      found: true,
      invoiceId: r.invoiceId as string,
      kind: r.kind as "order" | "bill",
      issuedAt: r.issuedAt as string,
      dueDate: r.dueDate as string,
      amountTZS: Number(r.amountTZS),
      issuer: r.issuer as string,
      issuerCity: r.issuerCity as string,
    };
  },
};
