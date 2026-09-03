import { supabase, unwrap } from "@/lib/api/client";
import type { Role, User } from "@/mock/types";
import { profileToUser, type ProfileRow } from "@/lib/data/auth";
import type { Sale } from "@/lib/data/sales";

// BACKEND: driver oversight repository. Reuses the same admin_* RPCs as
// Settings -> Users for account lifecycle (create/reset password/suspend);
// adds the aggregated stats a driver-specific profile view needs.

export interface DriverStats {
  salesCount: number;
  salesTotalTZS: number;
  salesThisMonthTZS: number;
  depositsCount: number;
  depositsTotalTZS: number;
  distinctCustomers: number;
  distinctRoutes: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  lastLoadDate: string | null;
}

export interface DriverCustomer {
  customerId: string;
  name: string;
  salesCount: number;
  totalTZS: number;
  lastSaleDate: string;
}

export interface DriverRoute {
  locationId: string;
  name: string;
  swName: string;
  loadsCount: number;
  lastLoadDate: string;
}

export interface DriverOverview {
  profileId: string;
  salesTodayTZS: number;
  salesMonthTZS: number;
  salesTotalTZS: number;
  salesCount: number;
  distinctCustomers: number;
  depositsMonthTZS: number;
  lastSaleDate: string | null;
  lastLoadDate: string | null;
  loadedToday: boolean;
}

export interface DriverDay {
  date: string;
  amountTZS: number;
  salesCount: number;
}

export const driverKeys = {
  all: ["drivers"] as const,
  list: () => ["drivers", "list"] as const,
  stats: (id: string) => ["drivers", "stats", id] as const,
  customers: (id: string) => ["drivers", "customers", id] as const,
  routes: (id: string) => ["drivers", "routes", id] as const,
  sales: (id: string) => ["drivers", "sales", id] as const,
  deposits: (id: string) => ["drivers", "deposits", id] as const,
  overview: () => ["drivers", "overview"] as const,
  daily: (id: string, days: number) => ["drivers", "daily", id, days] as const,
};

export const driversRepo = {
  /** Every account holding the route role, admin or not. */
  async list(): Promise<User[]> {
    const rows = unwrap(
      await supabase.from("profiles").select("*").contains("roles", ["route"]).order("name"),
    ) as ProfileRow[];
    return rows.map(profileToUser);
  },

  /** Headline figures for the whole roster in one round trip, so the card
   *  grid doesn't fire a driver_stats call per driver. */
  async overview(): Promise<DriverOverview[]> {
    const { data, error } = await supabase.rpc("drivers_overview");
    if (error) throw new Error(error.message);
    return (
      data as {
        profile_id: string;
        sales_today_tzs: number;
        sales_month_tzs: number;
        sales_total_tzs: number;
        sales_count: number;
        distinct_customers: number;
        deposits_month_tzs: number;
        last_sale_date: string | null;
        last_load_date: string | null;
        loaded_today: boolean;
      }[]
    ).map((r) => ({
      profileId: r.profile_id,
      salesTodayTZS: Number(r.sales_today_tzs),
      salesMonthTZS: Number(r.sales_month_tzs),
      salesTotalTZS: Number(r.sales_total_tzs),
      salesCount: Number(r.sales_count),
      distinctCustomers: Number(r.distinct_customers),
      depositsMonthTZS: Number(r.deposits_month_tzs),
      lastSaleDate: r.last_sale_date,
      lastLoadDate: r.last_load_date,
      loadedToday: r.loaded_today,
    }));
  },

  /** Daily sales for one driver, gap-filled, for the trend on their page. */
  async dailySales(profileId: string, days = 14): Promise<DriverDay[]> {
    const { data, error } = await supabase.rpc("driver_daily_sales", {
      p_profile_id: profileId,
      p_days: days,
    });
    if (error) throw new Error(error.message);
    return (data as { date: string; amount_tzs: number; sales_count: number }[]).map((r) => ({
      date: r.date,
      amountTZS: Number(r.amount_tzs),
      salesCount: Number(r.sales_count),
    }));
  },

  async stats(profileId: string): Promise<DriverStats> {
    const { data, error } = await supabase.rpc("driver_stats", { p_profile_id: profileId });
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      salesCount: Number(r.salesCount ?? 0),
      salesTotalTZS: Number(r.salesTotalTZS ?? 0),
      salesThisMonthTZS: Number(r.salesThisMonthTZS ?? 0),
      depositsCount: Number(r.depositsCount ?? 0),
      depositsTotalTZS: Number(r.depositsTotalTZS ?? 0),
      distinctCustomers: Number(r.distinctCustomers ?? 0),
      distinctRoutes: Number(r.distinctRoutes ?? 0),
      firstSaleDate: (r.firstSaleDate as string) ?? null,
      lastSaleDate: (r.lastSaleDate as string) ?? null,
      lastLoadDate: (r.lastLoadDate as string) ?? null,
    };
  },

  async customers(profileId: string): Promise<DriverCustomer[]> {
    const { data, error } = await supabase.rpc("driver_customers", { p_profile_id: profileId });
    if (error) throw new Error(error.message);
    return (
      data as {
        customer_id: string;
        name: string;
        sales_count: number;
        total_tzs: number;
        last_sale_date: string;
      }[]
    ).map((r) => ({
      customerId: r.customer_id,
      name: r.name,
      salesCount: Number(r.sales_count),
      totalTZS: Number(r.total_tzs),
      lastSaleDate: r.last_sale_date,
    }));
  },

  async routes(profileId: string): Promise<DriverRoute[]> {
    const { data, error } = await supabase.rpc("driver_routes", { p_profile_id: profileId });
    if (error) throw new Error(error.message);
    return (
      data as {
        location_id: string;
        name: string;
        sw_name: string;
        loads_count: number;
        last_load_date: string;
      }[]
    ).map((r) => ({
      locationId: r.location_id,
      name: r.name,
      swName: r.sw_name,
      loadsCount: Number(r.loads_count),
      lastLoadDate: r.last_load_date,
    }));
  },

  /** Most recent route sales, for the profile's activity list. */
  async recentSales(profileId: string, limit = 15): Promise<Sale[]> {
    const rows = unwrap(
      await supabase
        .from("sales")
        .select("*")
        .eq("sold_by", profileId)
        .eq("channel", "route")
        .order("at", { ascending: false })
        .limit(limit),
    ) as {
      id: string;
      at: string;
      date: string;
      channel: "counter" | "route";
      customer_id: string | null;
      customer_name: string | null;
      payment: Sale["payment"];
      tier: Sale["tier"];
      total_tzs: number;
      voided: boolean;
    }[];
    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      date: r.date,
      channel: r.channel,
      customerId: r.customer_id,
      customerName: r.customer_name,
      payment: r.payment,
      tier: r.tier,
      totalTZS: Number(r.total_tzs),
    }));
  },

  /** Most recent cash-up deposits this driver banked. */
  async recentDeposits(profileId: string, limit = 15) {
    const rows = unwrap(
      await supabase
        .from("deposits")
        .select("id, date, at, amount_tzs, method, ref")
        .eq("recorded_by", profileId)
        .eq("source", "route")
        .order("at", { ascending: false })
        .limit(limit),
    ) as {
      id: string;
      date: string;
      at: string;
      amount_tzs: number;
      method: string;
      ref: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      at: r.at,
      amountTZS: Number(r.amount_tzs),
      method: r.method,
      ref: r.ref,
    }));
  },

  /** Creates a driver account: same admin_create_user RPC as Settings ->
   *  Users, with the route role preset. */
  async create(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<User> {
    const { data, error } = await supabase.rpc("admin_create_user", {
      p_email: input.email,
      p_password: input.password,
      p_name: input.name,
      p_phone: input.phone,
      p_roles: ["route"] as Role[],
    });
    if (error) throw new Error(error.message);
    return profileToUser(data as ProfileRow);
  },

  async setPassword(id: string, password: string): Promise<void> {
    const { error } = await supabase.rpc("admin_set_password", {
      p_profile_id: id,
      p_password: password,
    });
    if (error) throw new Error(error.message);
  },

  /** Ban (suspend) or reinstate; also bans/unbans the auth account server-side. */
  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase.rpc("admin_set_active", {
      p_profile_id: id,
      p_active: active,
    });
    if (error) throw new Error(error.message);
  },
};
