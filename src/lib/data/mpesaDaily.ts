import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: the daily M-Pesa sales book. Milk leaves over M-Pesa all day in
// ones and twos and nobody rings each one into the counter; what gets
// written down is litres and money, once, for the day. Deliberately not a
// deposit: a deposit is money moved into an account, this is a sale that
// happened, and mixing them would double count the moment the day's
// takings are banked.

export interface MpesaEntry {
  id: string;
  date: string;
  litres: number;
  amountTZS: number;
  note: string | null;
}

export interface MpesaDay {
  date: string;
  litres: number;
  amountTZS: number;
  perLitre: number;
  entries: number;
}

export const mpesaKeys = {
  all: ["mpesaDaily"] as const,
  range: (from: string, to: string) => ["mpesaDaily", from, to] as const,
};

export const mpesaRepo = {
  async list(from: string, to: string): Promise<MpesaEntry[]> {
    const rows = unwrap(
      await supabase
        .from("mpesa_daily_sales")
        .select("*")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as { id: string; date: string; litres: number; amount_tzs: number; note: string | null }[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      litres: Number(r.litres),
      amountTZS: Number(r.amount_tzs),
      note: r.note,
    }));
  },

  /** Per day, with the implied price per litre: a figure that drifts from
   *  the usual one means the litres or the money was mistyped. */
  async summary(from: string, to: string): Promise<MpesaDay[]> {
    const { data, error } = await supabase.rpc("mpesa_daily_summary", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);
    return (
      data as {
        date: string;
        litres: number;
        amount_tzs: number;
        per_litre: number;
        entries: number;
      }[]
    ).map((r) => ({
      date: r.date,
      litres: Number(r.litres),
      amountTZS: Number(r.amount_tzs),
      perLitre: Number(r.per_litre),
      entries: Number(r.entries),
    }));
  },

  async record(input: { date: string; litres: number; amountTZS: number; note?: string }) {
    const { error } = await supabase.rpc("record_mpesa_day", {
      p_date: input.date,
      p_litres: input.litres,
      p_amount: input.amountTZS,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async update(input: {
    id: string;
    date: string;
    litres: number;
    amountTZS: number;
    note?: string;
  }) {
    const { error } = await supabase.rpc("update_mpesa_day", {
      p_id: input.id,
      p_date: input.date,
      p_litres: input.litres,
      p_amount: input.amountTZS,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string) {
    const { error } = await supabase.rpc("delete_mpesa_day", { p_id: id });
    if (error) throw new Error(error.message);
  },
};

// --- Expense opening balance -------------------------------------------------

export interface ExpenseMonthBalance {
  month: string;
  site: string;
  opening: number;
  spent: number;
  closing: number;
  previousMonth: string;
  /** Last month's closing, so "same as last month" is a figure the system
   *  offers rather than one somebody has to go and look up. */
  suggestedOpening: number;
  isSet: boolean;
}

export const expenseOpeningKeys = {
  all: ["expenseOpening"] as const,
  month: (month: string, site: string) => ["expenseOpening", month, site] as const,
};

export const expenseOpeningRepo = {
  async balance(month: string, site: string): Promise<ExpenseMonthBalance> {
    const { data, error } = await supabase.rpc("expense_month_balance", {
      p_month: month,
      p_site: site,
    });
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      month: String(r.month),
      site: String(r.site),
      opening: Number(r.opening ?? 0),
      spent: Number(r.spent ?? 0),
      closing: Number(r.closing ?? 0),
      previousMonth: String(r.previousMonth),
      suggestedOpening: Number(r.suggestedOpening ?? 0),
      isSet: Boolean(r.isSet),
    };
  },

  async set(month: string, site: string, amount: number, note?: string) {
    const { error } = await supabase.rpc("set_expense_opening", {
      p_month: month,
      p_site: site,
      p_amount: amount,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },
};
