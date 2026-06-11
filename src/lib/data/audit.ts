import { supabase, unwrap } from "@/lib/api/client";
import type { AuditAction, AuditEntry, AuditModule } from "@/mock/data";

// BACKEND: audit repository. Every repository mutation calls recordAudit()
// so the Settings -> Audit tab stays live. Domain RPCs (record_collection,
// complete_sale, lock_day...) audit server-side; this helper covers plain
// table CRUD done from the client.

export async function recordAudit(
  action: AuditAction,
  module: AuditModule,
  summarySw: string,
  summaryEn: string,
): Promise<void> {
  const { error } = await supabase.rpc("record_audit", {
    p_action: action,
    p_module: module,
    p_sw: summarySw,
    p_en: summaryEn,
  });
  if (error) console.error("recordAudit failed:", error.message);
}

interface AuditRow {
  id: string;
  at: string;
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  module: AuditModule;
  summary_sw: string;
  summary_en: string;
  ip: string | null;
}

export const auditKeys = {
  all: ["audit"] as const,
  list: (limit: number) => ["audit", "list", limit] as const,
};

export const auditRepo = {
  async list(limit = 100): Promise<AuditEntry[]> {
    const rows = unwrap(
      await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(limit),
    ) as AuditRow[];
    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      actor: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      module: r.module,
      summary: { sw: r.summary_sw, en: r.summary_en },
      ip: r.ip ?? undefined,
    }));
  },
};
