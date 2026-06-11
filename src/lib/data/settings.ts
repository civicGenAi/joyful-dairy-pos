import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { Role, User } from "@/mock/types";
import { profileToUser, type ProfileRow } from "@/lib/data/auth";

// BACKEND: settings repository: users (profiles) + company settings.
// Note: creating a profile here does NOT provision a Supabase auth account;
// the new user can sign in once an admin creates the auth user (seed script
// or Supabase dashboard). The profile row links by email at that point.

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

  async create(input: {
    name: string;
    email: string;
    phone: string;
    roles: Role[];
  }): Promise<User> {
    const row = unwrap(
      await supabase
        .from("profiles")
        .insert({
          name: input.name,
          email: input.email,
          phone: input.phone,
          roles: input.roles,
        })
        .select("*")
        .single(),
    ) as ProfileRow;
    await recordAudit(
      "create",
      "settings",
      `Ameongeza mtumiaji mpya (${input.name})`,
      `Added a new user (${input.name})`,
    );
    return profileToUser(row);
  },

  async setRoles(id: string, name: string, roles: Role[]): Promise<void> {
    unwrap(await supabase.from("profiles").update({ roles }).eq("id", id).select("id"));
    await recordAudit(
      "role-change",
      "settings",
      `Amebadilisha majukumu ya ${name} (${roles.join(", ")})`,
      `Changed roles for ${name} (${roles.join(", ")})`,
    );
  },

  async setActive(id: string, name: string, active: boolean): Promise<void> {
    unwrap(await supabase.from("profiles").update({ active }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "settings",
      active ? `Amewasha akaunti ya ${name}` : `Amezima akaunti ya ${name}`,
      active ? `Enabled ${name}'s account` : `Disabled ${name}'s account`,
    );
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
    unwrap(await supabase.from("company_settings").update(row).eq("id", 1).select("id"));
    await recordAudit(
      "edit",
      "settings",
      "Amesasisha mipangilio ya kampuni",
      "Updated company settings",
    );
  },
};
