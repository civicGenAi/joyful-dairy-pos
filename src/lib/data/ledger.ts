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

export interface PostingStatus {
  lastPostedDate: string | null;
  unpostedCount: number;
  oldestUnposted: string | null;
}

export interface LockedPeriod {
  period: string;
  lockedAt: string;
  lockedByName: string | null;
  note: string | null;
}

export interface BankRecLine {
  lineId: string;
  entryDate: string;
  memo: string;
  sourceKind: string;
  debit: number;
  credit: number;
  cleared: boolean;
}

export interface BankRecSummary {
  ledgerBalance: number;
  clearedBalance: number;
  unclearedTotal: number;
  unclearedCount: number;
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
  status: () => ["ledger", "status"] as const,
  locks: () => ["ledger", "locks"] as const,
  bankRec: (account: string, asAt: string) => ["ledger", "bankRec", account, asAt] as const,
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

  /** How current the books are, so a gap is visible rather than inferred. */
  /** An accrual, a prepayment, a correction: the entries an accountant
   *  needs that no posting engine can produce. */
  async manualEntry(
    date: string,
    memo: string,
    lines: { account: string; debit: number; credit: number; memo?: string }[],
  ): Promise<void> {
    const { error } = await supabase.rpc("gl_manual_entry", {
      p_date: date,
      p_memo: memo,
      p_lines: lines,
    });
    if (error) throw new Error(error.message);
  },

  async bankRecLines(account: string, asAt: string): Promise<BankRecLine[]> {
    const { data, error } = await supabase.rpc("bank_rec_lines", {
      p_account: account,
      p_as_at: asAt,
    });
    if (error) throw new Error(error.message);
    return (
      data as {
        line_id: string;
        entry_date: string;
        memo: string;
        source_kind: string;
        debit: number;
        credit: number;
        cleared: boolean;
      }[]
    ).map((r) => ({
      lineId: r.line_id,
      entryDate: r.entry_date,
      memo: r.memo,
      sourceKind: r.source_kind,
      debit: Number(r.debit),
      credit: Number(r.credit),
      cleared: r.cleared,
    }));
  },

  async bankRecSummary(account: string, asAt: string): Promise<BankRecSummary> {
    const { data, error } = await supabase.rpc("bank_rec_summary", {
      p_account: account,
      p_as_at: asAt,
    });
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ledgerBalance: Number(r.ledgerBalance ?? 0),
      clearedBalance: Number(r.clearedBalance ?? 0),
      unclearedTotal: Number(r.unclearedTotal ?? 0),
      unclearedCount: Number(r.unclearedCount ?? 0),
    };
  },

  async setCleared(lineIds: string[], cleared: boolean): Promise<void> {
    const { error } = await supabase.rpc("bank_rec_set_cleared", {
      p_line_ids: lineIds,
      p_cleared: cleared,
    });
    if (error) throw new Error(error.message);
  },

  /** A difference is stored rather than refused: finding one is the point,
   *  and refusing to save it would mean nobody records the day they did. */
  async closeBankRec(
    account: string,
    statementDate: string,
    statementBalance: number,
    note?: string,
  ): Promise<{ difference: number }> {
    const { data, error } = await supabase.rpc("bank_rec_close", {
      p_account: account,
      p_statement_date: statementDate,
      p_statement_balance: statementBalance,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
    return { difference: Number((data as Record<string, unknown>).difference ?? 0) };
  },

  async postingStatus(): Promise<PostingStatus> {
    const { data, error } = await supabase.rpc("gl_posting_status");
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      lastPostedDate: (r.lastPostedDate as string) ?? null,
      unpostedCount: Number(r.unpostedCount ?? 0),
      oldestUnposted: (r.oldestUnposted as string) ?? null,
    };
  },

  async lockedPeriods(): Promise<LockedPeriod[]> {
    const { data, error } = await supabase.rpc("gl_locked_periods");
    if (error) throw new Error(error.message);
    return (
      data as {
        period: string;
        locked_at: string;
        locked_by_name: string | null;
        note: string | null;
      }[]
    ).map((r) => ({
      period: r.period,
      lockedAt: r.locked_at,
      lockedByName: r.locked_by_name,
      note: r.note,
    }));
  },

  /** Refused while anything in the month is still outside the ledger, so a
   *  lock can never freeze a period with transactions stranded outside it. */
  async lockPeriod(period: string, note?: string): Promise<void> {
    const { error } = await supabase.rpc("gl_lock_period", {
      p_period: period,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async unlockPeriod(period: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc("gl_unlock_period", {
      p_period: period,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
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
