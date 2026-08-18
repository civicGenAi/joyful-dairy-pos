import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { Role, User } from "@/mock/types";
import { profileToUser, type ProfileRow } from "@/lib/data/auth";

// BACKEND: settings repository: users (profiles) + company settings.
// User lifecycle goes through the admin_* RPCs (security definer, gated on
// users:write) so a created user can sign in immediately, passwords can be
// changed, and suspension also bans the auth account.

export interface CompanySettings {
  name: string;
  city: string;
  tagline: string;
  footer: string;
  phone: string;
  email: string;
  vrn: string;
  tin: string;
  alertThresholds: Record<string, unknown>;
  reportSchedule: Record<string, unknown>;
  /** Mpesa Lipa Namba shown on printed invoices' "Pay by" box. */
  mpesaLipaNamba: string;
  bankName: string;
  bankAccount: string;
}

export const settingsKeys = {
  all: ["settings"] as const,
  users: () => ["settings", "users"] as const,
  company: () => ["settings", "company"] as const,
};

export const usersRepo = {
  async list(): Promise<User[]> {
    const rows = unwrap(await supabase.from("profiles").select("*").order("name")) as ProfileRow[];
    return rows.map(profileToUser);
  },

  /** Creates the auth account + profile in one transaction; signs in right away. */
  async create(input: {
    name: string;
    email: string;
    phone: string;
    roles: Role[];
    password: string;
  }): Promise<User> {
    const { data, error } = await supabase.rpc("admin_create_user", {
      p_email: input.email,
      p_password: input.password,
      p_name: input.name,
      p_phone: input.phone,
      p_roles: input.roles,
    });
    if (error) throw new Error(error.message);
    return profileToUser(data as ProfileRow);
  },

  async setRoles(id: string, _name: string, roles: Role[]): Promise<void> {
    const { error } = await supabase.rpc("admin_set_roles", {
      p_profile_id: id,
      p_roles: roles,
    });
    if (error) throw new Error(error.message);
  },

  /** Suspend or reinstate: also bans/unbans the auth account server-side. */
  async setActive(id: string, _name: string, active: boolean): Promise<void> {
    const { error } = await supabase.rpc("admin_set_active", {
      p_profile_id: id,
      p_active: active,
    });
    if (error) throw new Error(error.message);
  },

  async setPassword(id: string, password: string): Promise<void> {
    const { error } = await supabase.rpc("admin_set_password", {
      p_profile_id: id,
      p_password: password,
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.rpc("admin_delete_user", { p_profile_id: id });
    if (error) throw new Error(error.message);
  },
};

interface CompanyRow {
  name: string;
  city: string;
  tagline: string;
  footer: string;
  phone: string;
  email: string;
  vrn: string;
  tin: string;
  alert_thresholds: Record<string, unknown>;
  report_schedule: Record<string, unknown>;
  mpesa_lipa_namba: string | null;
  bank_name: string | null;
  bank_account: string | null;
}

export const companyRepo = {
  async get(): Promise<CompanySettings> {
    const r = unwrap(
      await supabase.from("company_settings").select("*").eq("id", 1).single(),
    ) as CompanyRow;
    return {
      name: r.name,
      city: r.city,
      tagline: r.tagline,
      footer: r.footer,
      phone: r.phone,
      email: r.email,
      vrn: r.vrn,
      tin: r.tin,
      alertThresholds: r.alert_thresholds ?? {},
      reportSchedule: r.report_schedule ?? {},
      mpesaLipaNamba: r.mpesa_lipa_namba ?? "",
      bankName: r.bank_name ?? "",
      bankAccount: r.bank_account ?? "",
    };
  },

  async update(patch: Partial<CompanySettings>): Promise<void> {
    const row: Partial<CompanyRow> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.tagline !== undefined) row.tagline = patch.tagline;
    if (patch.footer !== undefined) row.footer = patch.footer;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.vrn !== undefined) row.vrn = patch.vrn;
    if (patch.tin !== undefined) row.tin = patch.tin;
    if (patch.alertThresholds !== undefined) row.alert_thresholds = patch.alertThresholds;
    if (patch.reportSchedule !== undefined) row.report_schedule = patch.reportSchedule;
    if (patch.mpesaLipaNamba !== undefined) row.mpesa_lipa_namba = patch.mpesaLipaNamba;
    if (patch.bankName !== undefined) row.bank_name = patch.bankName;
    if (patch.bankAccount !== undefined) row.bank_account = patch.bankAccount;
    unwrap(await supabase.from("company_settings").update(row).eq("id", 1).select("id"));
    await recordAudit(
      "edit",
      "settings",
      "Amesasisha mipangilio ya kampuni",
      "Updated company settings",
    );
  },
};
