import { supabase } from "@/lib/api/client";

// BACKEND: Joseph's own sales and deposits. A separate salesperson with his
// own book: he sells milk at one of five fixed rates, and banks what he
// collects by M-Pesa or bank, apart from the main deposits log. Standalone
// by design, the same way the daily M-Pesa book is: it does not touch
// stock, the customer or farmer ledgers, or the accounting journal, so his
// numbers can be seen clearly on their own.

export interface JosephRate {
  rateTZS: number;
}

export interface JosephSale {
  id: string;
  date: string;
  rateTZS: number;
  litres: number;
}

export interface JosephDeposit {
  id: string;
  date: string;
  amountTZS: number;
  channel: "mpesa" | "bank";
  note: string | null;
}

export interface JosephDay {
  date: string;
  litres: number;
  revenueTZS: number;
  mpesaTZS: number;
  bankTZS: number;
  depositedTZS: number;
  differenceTZS: number;
  salesEntries: number;
  depositEntries: number;
}

export interface JosephRateBreakdown {
  rateTZS: number;
  litres: number;
  revenueTZS: number;
  entries: number;
}

export const josephKeys = {
  all: ["joseph"] as const,
  rates: () => ["joseph", "rates"] as const,
  summary: (from: string, to: string) => ["joseph", "summary", from, to] as const,
  breakdown: (from: string, to: string) => ["joseph", "breakdown", from, to] as const,
  sales: (from: string, to: string) => ["joseph", "sales", from, to] as const,
  deposits: (from: string, to: string) => ["joseph", "deposits", from, to] as const,
};

export const josephRepo = {
  async rates(): Promise<number[]> {
    const { data, error } = await supabase
      .from("joseph_rates")
      .select("rate_tzs")
      .eq("active", true)
      .order("rate_tzs", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as { rate_tzs: number }[]).map((r) => Number(r.rate_tzs));
  },

  async sales(from: string, to: string): Promise<JosephSale[]> {
    const { data, error } = await supabase
      .from("joseph_sales")
      .select("id, date, rate_tzs, litres")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as { id: string; date: string; rate_tzs: number; litres: number }[]).map((r) => ({
      id: r.id,
      date: r.date,
      rateTZS: Number(r.rate_tzs),
      litres: Number(r.litres),
    }));
  },

  async deposits(from: string, to: string): Promise<JosephDeposit[]> {
    const { data, error } = await supabase
      .from("joseph_deposits")
      .select("id, date, amount_tzs, channel, note")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        date: string;
        amount_tzs: number;
        channel: "mpesa" | "bank";
        note: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      date: r.date,
      amountTZS: Number(r.amount_tzs),
      channel: r.channel,
      note: r.note,
    }));
  },

  /** Per day: litres across every rate, the revenue that implies, what was
   *  banked by channel, and the gap between the two. */
  async dailySummary(from: string, to: string): Promise<JosephDay[]> {
    const { data, error } = await supabase.rpc("joseph_daily_summary", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);
    return (
      data as {
        date: string;
        litres: number;
        revenue_tzs: number;
        mpesa_tzs: number;
        bank_tzs: number;
        deposited_tzs: number;
        difference_tzs: number;
        sales_entries: number;
        deposit_entries: number;
      }[]
    ).map((r) => ({
      date: r.date,
      litres: Number(r.litres),
      revenueTZS: Number(r.revenue_tzs),
      mpesaTZS: Number(r.mpesa_tzs),
      bankTZS: Number(r.bank_tzs),
      depositedTZS: Number(r.deposited_tzs),
      differenceTZS: Number(r.difference_tzs),
      salesEntries: Number(r.sales_entries),
      depositEntries: Number(r.deposit_entries),
    }));
  },

  /** Litres and revenue at each rate over the window: "how much came in at
   *  1700, how much at 1600", for a day, a week, a month or a year. */
  async rateBreakdown(from: string, to: string): Promise<JosephRateBreakdown[]> {
    const { data, error } = await supabase.rpc("joseph_rate_breakdown", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);
    return (
      data as { rate_tzs: number; litres: number; revenue_tzs: number; entries: number }[]
    ).map((r) => ({
      rateTZS: Number(r.rate_tzs),
      litres: Number(r.litres),
      revenueTZS: Number(r.revenue_tzs),
      entries: Number(r.entries),
    }));
  },

  /** Records a whole day's litres across every rate in one call. A rate
   *  left at zero clears that rate's row for the day. */
  async recordDay(date: string, rates: { rateTZS: number; litres: number }[]): Promise<void> {
    const { error } = await supabase.rpc("record_joseph_day", {
      p_date: date,
      p_rates: rates.map((r) => ({ rate_tzs: r.rateTZS, litres: r.litres })),
    });
    if (error) throw new Error(error.message);
  },

  async deleteSale(id: string): Promise<void> {
    const { error } = await supabase.rpc("delete_joseph_sale", { p_id: id });
    if (error) throw new Error(error.message);
  },

  async recordDeposit(input: {
    date: string;
    amountTZS: number;
    channel: "mpesa" | "bank";
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("record_joseph_deposit", {
      p_date: input.date,
      p_amount: input.amountTZS,
      p_channel: input.channel,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async updateDeposit(input: {
    id: string;
    date: string;
    amountTZS: number;
    channel: "mpesa" | "bank";
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("update_joseph_deposit", {
      p_id: input.id,
      p_date: input.date,
      p_amount: input.amountTZS,
      p_channel: input.channel,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async deleteDeposit(id: string): Promise<void> {
    const { error } = await supabase.rpc("delete_joseph_deposit", { p_id: id });
    if (error) throw new Error(error.message);
  },
};
