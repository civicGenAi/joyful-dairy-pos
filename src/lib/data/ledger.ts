import { supabase } from "@/lib/api/client";

// BACKEND: the general ledger. Every figure here is derived from journal
// entries written by gl_post_range(), which reads the operational tables.
// Nothing in this file computes accounting itself, it only reads what the
// ledger already says, so the screens can never disagree with the books.

export interface LedgerAccount {
  code: string;
  name: string;
  swName: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subtype: string | null;
  debit?: number;
  credit?: number;
  amount: number;
}

export interface VatReturn {
  from: string;
  to: string;
  salesExVat: number;
  exemptSales: number;
  outputVat: number;
  inputVat: number;
  netPayable: number;
}

interface RowBase {
  code: string;
  name: string;
  sw_name: string;
  type: LedgerAccount["type"];
  subtype: string | null;
}

function toAccount(
  r: RowBase & { amount?: number; debit?: number; credit?: number },
): LedgerAccount {
  return {
    code: r.code,
    name: r.name,
    swName: r.sw_name,
    type: r.type,
    subtype: r.subtype,
    debit: r.debit !== undefined ? Number(r.debit) : undefined,
    credit: r.credit !== undefined ? Number(r.credit) : undefined,
    amount: Number(r.amount ?? 0),
  };
}

export interface OpeningLine {
  code: string;
  name: string;
  swName: string;
  type: string;
  amount: number;
}

export interface OpeningBalances {
  date: string | null;
  lines: OpeningLine[];
}

export interface CashFlow {
  from: string;
  to: string;
  profit: number;
  depreciation: number;
  receivablesChange: number;
  payablesChange: number;
  taxPayablesChange: number;
  operating: number;
  assetsPurchased: number;
  investing: number;
  ownerDrawings: number;
  capitalIntroduced: number;
  financing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  /** Zero when the statement reconciles. Non-zero is reported, not hidden. */
  unexplained: number;
}

export const ledgerKeys = {
  all: ["ledger"] as const,
  trial: (from: string, to: string) => ["ledger", "trial", from, to] as const,
  pl: (from: string, to: string) => ["ledger", "pl", from, to] as const,
  bs: (asAt: string) => ["ledger", "bs", asAt] as const,
  vat: (from: string, to: string) => ["ledger", "vat", from, to] as const,
  opening: () => ["ledger", "opening"] as const,
  suggested: () => ["ledger", "suggestedOpening"] as const,
  cashFlow: (from: string, to: string) => ["ledger", "cashFlow", from, to] as const,
};

export const ledgerRepo = {
  async trialBalance(from: string, to: string): Promise<LedgerAccount[]> {
    const { data, error } = await supabase.rpc("gl_trial_balance", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    return (data as (RowBase & { debit: number; credit: number; balance: number })[]).map((r) =>
      toAccount({ ...r, amount: r.balance }),
    );
  },

  async profitLoss(from: string, to: string): Promise<LedgerAccount[]> {
    const { data, error } = await supabase.rpc("gl_profit_loss", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    return (data as (RowBase & { amount: number })[]).map(toAccount);
  },

  async balanceSheet(asAt: string): Promise<LedgerAccount[]> {
    const { data, error } = await supabase.rpc("gl_balance_sheet", { p_as_at: asAt });
    if (error) throw new Error(error.message);
    return (data as (RowBase & { amount: number })[]).map(toAccount);
  },

  async vatReturn(from: string, to: string): Promise<VatReturn> {
    const { data, error } = await supabase.rpc("gl_vat_return", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    return {
      from: String(r.from),
      to: String(r.to),
      salesExVat: Number(r.salesExVat ?? 0),
      exemptSales: Number(r.exemptSales ?? 0),
      outputVat: Number(r.outputVat ?? 0),
      inputVat: Number(r.inputVat ?? 0),
      netPayable: Number(r.netPayable ?? 0),
    };
  },

  async cashFlow(from: string, to: string): Promise<CashFlow> {
    const { data, error } = await supabase.rpc("gl_cash_flow", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    const n = (k: string) => Number(r[k] ?? 0);
    return {
      from: String(r.from),
      to: String(r.to),
      profit: n("profit"),
      depreciation: n("depreciation"),
      receivablesChange: n("receivablesChange"),
      payablesChange: n("payablesChange"),
      taxPayablesChange: n("taxPayablesChange"),
      operating: n("operating"),
      assetsPurchased: n("assetsPurchased"),
      investing: n("investing"),
      ownerDrawings: n("ownerDrawings"),
      capitalIntroduced: n("capitalIntroduced"),
      financing: n("financing"),
      netChange: n("netChange"),
      openingCash: n("openingCash"),
      closingCash: n("closingCash"),
      unexplained: n("unexplained"),
    };
  },

  async openingBalances(): Promise<OpeningBalances> {
    const { data, error } = await supabase.rpc("gl_get_opening_balances");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      date: string;
      code: string;
      name: string;
      sw_name: string;
      type: string;
      amount: number;
    }[];
    return {
      date: rows[0]?.date ?? null,
      lines: rows.map((r) => ({
        code: r.code,
        name: r.name,
        swName: r.sw_name,
        type: r.type,
        amount: Number(r.amount),
      })),
    };
  },

  /** What the system already knows, so the opening form pre-fills rather
   *  than asking for figures it can work out itself. */
  async suggestedOpening(): Promise<{ receivables: number; farmerPayables: number }> {
    const { data, error } = await supabase.rpc("gl_suggested_opening");
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      receivables: Number(r.receivables ?? 0),
      farmerPayables: Number(r.farmerPayables ?? 0),
    };
  },

  /** Replaces the opening entry outright, so a wrong figure is corrected
   *  rather than stacked on top of. Owner capital is derived, not typed. */
  async setOpeningBalances(
    date: string,
    lines: { account: string; amount: number }[],
  ): Promise<{ ownerCapital: number }> {
    const { data, error } = await supabase.rpc("gl_set_opening_balances", {
      p_date: date,
      p_lines: lines,
    });
    if (error) throw new Error(error.message);
    return { ownerCapital: Number((data as Record<string, unknown>).ownerCapital ?? 0) };
  },

  /** Posts every unposted transaction in the range. Safe to re-run: entries
   *  are keyed by source, so a second run over the same days posts nothing. */
  async post(from: string, to: string): Promise<{ posted: number }> {
    const { data, error } = await supabase.rpc("gl_post_range", { p_from: from, p_to: to });
    if (error) throw new Error(error.message);
    return { posted: Number((data as Record<string, unknown>).posted ?? 0) };
  },
};
