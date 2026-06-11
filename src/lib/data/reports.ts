import { supabase } from "@/lib/api/client";
import type { Alert } from "@/mock/types";

// BACKEND: chart + report rollups (RPCs over the movement ledger) and the
// computed alerts feed. Replaces MILK_TREND_30, SALES_BY_CATEGORY_WEEK,
// SALES_CHANNEL_SPLIT, TOP_CUSTOMERS, YIELD_WEEK and ALERTS.

export interface MilkTrendPoint {
  date: string;
  collected: number;
  sold: number;
  spoilt: number;
}

export interface CategorySalesPoint {
  date: string;
  category: string;
  qty: number;
  amountTZS: number;
}

export interface ChannelSplitPoint {
  channel: "counter" | "route";
  payment: string;
  amountTZS: number;
}

export interface TopCustomerPoint {
  customerId: string | null;
  name: string;
  amountTZS: number;
}

export const reportKeys = {
  all: ["reports"] as const,
  milkTrend: (days: number) => ["reports", "milkTrend", days] as const,
  salesByCategory: (from: string, to: string) => ["reports", "salesByCategory", from, to] as const,
  channelSplit: (from: string, to: string) => ["reports", "channelSplit", from, to] as const,
  topCustomers: (from: string, to: string) => ["reports", "topCustomers", from, to] as const,
  alerts: () => ["alerts"] as const,
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const reportsRepo = {
  async milkTrend(days = 30): Promise<MilkTrendPoint[]> {
    const rows = await rpc<{ date: string; collected: number; sold: number; spoilt: number }[]>(
      "milk_trend",
      { p_days: days },
    );
    return rows.map((r) => ({
      date: r.date,
      collected: Number(r.collected),
      sold: Number(r.sold),
      spoilt: Number(r.spoilt),
    }));
  },

  async salesByCategory(from: string, to: string): Promise<CategorySalesPoint[]> {
    const rows = await rpc<{ date: string; category: string; qty: number; amount_tzs: number }[]>(
      "sales_by_category",
      { p_from: from, p_to: to },
    );
    return rows.map((r) => ({
      date: r.date,
      category: r.category,
      qty: Number(r.qty),
      amountTZS: Number(r.amount_tzs),
    }));
  },

  async channelSplit(from: string, to: string): Promise<ChannelSplitPoint[]> {
    const rows = await rpc<{ channel: "counter" | "route"; payment: string; amount_tzs: number }[]>(
      "sales_channel_split",
      { p_from: from, p_to: to },
    );
    return rows.map((r) => ({
      channel: r.channel,
      payment: r.payment,
      amountTZS: Number(r.amount_tzs),
    }));
  },

  async topCustomers(from: string, to: string, limit = 8): Promise<TopCustomerPoint[]> {
    const rows = await rpc<{ customer_id: string | null; name: string; amount_tzs: number }[]>(
      "top_customers",
      { p_from: from, p_to: to, p_limit: limit },
    );
    return rows.map((r) => ({
      customerId: r.customer_id,
      name: r.name,
      amountTZS: Number(r.amount_tzs),
    }));
  },
};

function timeAgo(at: string): string {
  const mins = Math.max(Math.round((Date.now() - new Date(at).getTime()) / 60000), 0);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return "Today";
}

export const alertsRepo = {
  async current(): Promise<Alert[]> {
    const rows = await rpc<
      {
        id: string;
        kind: Alert["kind"];
        title: string;
        detail: string;
        severity: Alert["severity"];
        at: string;
      }[]
    >("current_alerts", {});
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      detail: r.detail,
      severity: r.severity,
      timeAgo: timeAgo(r.at),
    }));
  },
};
