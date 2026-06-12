import { JoyLogo } from "@/components/brand/JoyLogo";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/app/context";
import { supabase } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { num, tzs } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  HardDrive,
  Mail,
  Activity,
  ShieldCheck,
  Boxes,
} from "lucide-react";

// Live system health console. Every row is a real probe against the running
// system: database, auth, storage, the reminder service and the data itself.
// When something fails, the row says where to look.

type CheckStatus = "ok" | "warn" | "fail" | "pending";

interface CheckResult {
  id: string;
  group: string;
  name: string;
  status: CheckStatus;
  detail: string;
  /** Where to look when this is red or amber. */
  hint?: string;
}

interface HealthSnapshot {
  dbTime: string;
  counts: Record<string, number>;
  today: {
    sales: number;
    salesTZS: number;
    collections: number;
    collectionLitres: number;
    deposits: number;
    movements: number;
    remindersSent: number;
    dayLocked: boolean;
  };
  integrity: {
    negativeStock: { name: string; onHand: number }[];
    lowStock: number;
    pendingAdjustments: number;
    unlinkedProfiles: number;
    lastAuditAt: string | null;
  };
  services: { reminderCron: boolean; buckets: string[] };
}

const STATUS_META: Record<CheckStatus, { color: string; Icon: typeof CheckCircle2 }> = {
  ok: { color: "#1D9E75", Icon: CheckCircle2 },
  warn: { color: "#E5A100", Icon: AlertTriangle },
  fail: { color: "#E11B22", Icon: XCircle },
  pending: { color: "#6B776E", Icon: RefreshCw },
};

const GROUP_ICONS: Record<string, typeof Database> = {
  connection: Database,
  services: Mail,
  data: Boxes,
  security: ShieldCheck,
  activity: Activity,
  storage: HardDrive,
};

export function StatusScreen() {
  const { t, user } = useApp();
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runChecks = useCallback(async () => {
    setRunning(true);
    const results: CheckResult[] = [];
    const add = (r: Omit<CheckResult, "group"> & { group?: string }) =>
      results.push({ group: "connection", ...r });

    // --- 1. Database reachability + latency -------------------------------
    const t0 = performance.now();
    try {
      const { error } = await supabase
        .from("locations")
        .select("id", { count: "exact", head: true });
      const ms = Math.round(performance.now() - t0);
      if (error) throw new Error(error.message);
      add({
        id: "db",
        name: t("Hifadhidata (Supabase)", "Database (Supabase)"),
        status: ms > 2500 ? "warn" : "ok",
        detail: t(`Imejibu kwa ms ${ms}`, `Responded in ${ms} ms`),
        hint:
          ms > 2500
            ? t("Mtandao wa polepole au mzigo mkubwa", "Slow network or heavy load")
            : undefined,
      });
    } catch (e) {
      add({
        id: "db",
        name: t("Hifadhidata (Supabase)", "Database (Supabase)"),
        status: "fail",
        detail: String(e),
        hint: t(
          "Angalia mtandao, kisha Supabase dashboard > Project health",
          "Check the network, then Supabase dashboard > Project health",
        ),
      });
    }

    // --- 2. Auth session + linked profile ---------------------------------
    try {
      const { data } = await supabase.auth.getSession();
      add({
        id: "auth",
        group: "security",
        name: t("Kikao na utambulisho", "Auth session & profile"),
        status: data.session && user ? "ok" : "fail",
        detail:
          data.session && user
            ? t(`Umeingia kama ${user.name}`, `Signed in as ${user.name}`)
            : t("Hakuna kikao halali", "No valid session"),
        hint: !user
          ? t(
              "Ingia upya; angalia profiles.auth_user_id",
              "Sign in again; check profiles.auth_user_id",
            )
          : undefined,
      });
    } catch (e) {
      add({
        id: "auth",
        group: "security",
        name: t("Kikao na utambulisho", "Auth session & profile"),
        status: "fail",
        detail: String(e),
      });
    }

    // --- 3. Server-side snapshot: counts, integrity, services -------------
    let snap: HealthSnapshot | null = null;
    try {
      const { data, error } = await supabase.rpc("health_check");
      if (error) throw new Error(error.message);
      snap = data as HealthSnapshot;
      setSnapshot(snap);

      add({
        id: "rpc",
        name: t("RPC za seva", "Server RPC layer"),
        status: "ok",
        detail: t(
          `health_check() imejibu, saa ya seva ${new Date(snap.dbTime).toLocaleTimeString()}`,
          `health_check() responded, server time ${new Date(snap.dbTime).toLocaleTimeString()}`,
        ),
      });

      const neg = snap.integrity.negativeStock;
      add({
        id: "negstock",
        group: "data",
        name: t("Stock hasi (haitakiwi)", "Negative stock (must never happen)"),
        status: neg.length === 0 ? "ok" : "fail",
        detail:
          neg.length === 0
            ? t("Hakuna bidhaa yenye idadi hasi", "No item is below zero")
            : neg.map((n) => `${n.name}: ${n.onHand}`).join(", "),
        hint:
          neg.length > 0
            ? t(
                "Harakati ya stock imerekodiwa vibaya; angalia Harakati kisha rekebisha kwa Adjust",
                "A movement was misrecorded; check Stock movements then correct with Adjust",
              )
            : undefined,
      });

      add({
        id: "lowstock",
        group: "data",
        name: t("Bidhaa chini ya kiwango", "Items at or below reorder level"),
        status: snap.integrity.lowStock === 0 ? "ok" : "warn",
        detail: t(
          `Bidhaa ${snap.integrity.lowStock} ziko chini ya kiwango cha kuagiza`,
          `${snap.integrity.lowStock} items are at or below their reorder level`,
        ),
        hint:
          snap.integrity.lowStock > 0
            ? t("Skrini ya Stock & Store, chuja kwa hali", "Stock & Store screen, filter by status")
            : undefined,
      });

      add({
        id: "adjustments",
        group: "data",
        name: t("Maombi ya marekebisho yanayosubiri", "Pending balance adjustments"),
        status: snap.integrity.pendingAdjustments === 0 ? "ok" : "warn",
        detail: t(
          `Maombi ${snap.integrity.pendingAdjustments} yanasubiri idhini`,
          `${snap.integrity.pendingAdjustments} requests await approval`,
        ),
        hint:
          snap.integrity.pendingAdjustments > 0
            ? t("Skrini ya Wafugaji, sehemu ya marekebisho", "Farmers screen, adjustments section")
            : undefined,
      });

      add({
        id: "unlinked",
        group: "security",
        name: t("Watumiaji wasiounganishwa", "Profiles without a login"),
        status: snap.integrity.unlinkedProfiles === 0 ? "ok" : "warn",
        detail: t(
          `Profaili ${snap.integrity.unlinkedProfiles} hazina akaunti ya kuingia`,
          `${snap.integrity.unlinkedProfiles} profiles have no auth account`,
        ),
        hint:
          snap.integrity.unlinkedProfiles > 0
            ? t(
                "Mipangilio > Watumiaji, unda upya akaunti",
                "Settings > Users, recreate the account",
              )
            : undefined,
      });

      add({
        id: "audit",
        group: "security",
        name: t("Daftari la ukaguzi", "Audit trail"),
        status: snap.integrity.lastAuditAt ? "ok" : "warn",
        detail: snap.integrity.lastAuditAt
          ? t(
              `Tukio la mwisho ${new Date(snap.integrity.lastAuditAt).toLocaleString()}`,
              `Last entry ${new Date(snap.integrity.lastAuditAt).toLocaleString()}`,
            )
          : t("Hakuna matukio bado", "No entries yet"),
      });

      add({
        id: "cron",
        group: "services",
        name: t("Ratiba ya vikumbusho (pg_cron)", "Reminder scheduler (pg_cron)"),
        status: snap.services.reminderCron ? "ok" : "warn",
        detail: snap.services.reminderCron
          ? t(
              "Kazi ya ajd-due-reminders ipo, kila 07:00 EAT",
              "ajd-due-reminders job exists, daily 07:00 EAT",
            )
          : t("Kazi haijapangwa", "Job is not scheduled"),
        hint: !snap.services.reminderCron
          ? t("Endesha bun run db:push (migration 00008)", "Run bun run db:push (migration 00008)")
          : undefined,
      });

      const wantBuckets = ["avatars", "receipts"];
      const missing = wantBuckets.filter((b) => !snap!.services.buckets.includes(b));
      add({
        id: "buckets",
        group: "storage",
        name: t("Hifadhi ya mafaili (Storage)", "File storage buckets"),
        status: missing.length === 0 ? "ok" : "fail",
        detail:
          missing.length === 0
            ? t("avatars na receipts zipo", "avatars and receipts exist")
            : t(`Zinakosekana: ${missing.join(", ")}`, `Missing: ${missing.join(", ")}`),
        hint:
          missing.length > 0
            ? t(
                "Endesha bun run db:push (migrations 00004/00006)",
                "Run bun run db:push (migrations 00004/00006)",
              )
            : undefined,
      });
    } catch (e) {
      add({
        id: "rpc",
        name: t("RPC za seva", "Server RPC layer"),
        status: "fail",
        detail: String(e),
        hint: t(
          "health_check() haipo: endesha bun run db:push (migration 00009)",
          "health_check() is missing: run bun run db:push (migration 00009)",
        ),
      });
    }

    // --- 4. Storage reachability (a real read, not just the catalog) ------
    try {
      const { error } = await supabase.storage.from("receipts").list("", { limit: 1 });
      add({
        id: "storage-read",
        group: "storage",
        name: t("Kusoma hifadhi ya risiti", "Receipts storage read"),
        status: error ? "fail" : "ok",
        detail: error ? error.message : t("Inasomeka", "Readable"),
        hint: error
          ? t(
              "Supabase dashboard > Storage > receipts policies",
              "Supabase dashboard > Storage > receipts policies",
            )
          : undefined,
      });
    } catch (e) {
      add({
        id: "storage-read",
        group: "storage",
        name: t("Kusoma hifadhi ya risiti", "Receipts storage read"),
        status: "fail",
        detail: String(e),
      });
    }

    // --- 5. Email service (the send-reminder edge function) ---------------
    // A ping invoke, not a raw OPTIONS fetch: cross-origin OPTIONS responses
    // are unreadable in strict browsers even when the function is healthy.
    try {
      const { data, error } = await supabase.functions.invoke("send-reminder", {
        body: { mode: "ping" },
      });
      if (error) throw error;
      const hasKey = (data as { hasResendKey?: boolean })?.hasResendKey === true;
      add({
        id: "fn",
        group: "services",
        name: t("Huduma ya barua pepe (send-reminder)", "Email service (send-reminder)"),
        status: hasKey ? "ok" : "warn",
        detail: hasKey
          ? t("Imetumwa na ina ufunguo wa Resend", "Deployed, Resend key configured")
          : t(
              "Imetumwa lakini RESEND_API_KEY haijawekwa",
              "Deployed but RESEND_API_KEY is not set",
            ),
        hint: !hasKey
          ? t(
              "Weka: supabase secrets set RESEND_API_KEY=...",
              "Set it: supabase secrets set RESEND_API_KEY=...",
            )
          : undefined,
      });
    } catch (e) {
      // An HTTP error still proves the function is deployed; it is just an
      // older version without the ping mode.
      const deployed = (e as { name?: string })?.name === "FunctionsHttpError";
      add({
        id: "fn",
        group: "services",
        name: t("Huduma ya barua pepe (send-reminder)", "Email service (send-reminder)"),
        status: deployed ? "warn" : "fail",
        detail: deployed
          ? t("Imetumwa, toleo la zamani", "Deployed, but an older version")
          : t("Haijafikika au haijatumwa", "Unreachable or not deployed"),
        hint: t(
          "Itume upya: supabase functions deploy send-reminder --no-verify-jwt",
          "Redeploy: supabase functions deploy send-reminder --no-verify-jwt",
        ),
      });
    }

    setChecks(results);
    setLastRun(new Date());
    setRunning(false);
  }, [t, user]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const overall: CheckStatus = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : checks.length
        ? "ok"
        : "pending";
  const banner = STATUS_META[overall];

  const groups: { id: string; label: string }[] = [
    { id: "connection", label: t("Muunganisho", "Connection") },
    { id: "services", label: t("Huduma", "Services") },
    { id: "storage", label: t("Hifadhi ya mafaili", "File storage") },
    { id: "data", label: t("Uadilifu wa data", "Data integrity") },
    { id: "security", label: t("Usalama", "Security") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 py-4">
          <JoyLogo />
          <Link
            to="/dashboard"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("Rudi kwenye mfumo", "Back to app")} →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-6">
        <div
          className="rounded-2xl p-6 text-white shadow-elevated flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${banner.color}, ${banner.color}cc)` }}
        >
          <banner.Icon className={`h-8 w-8 ${running ? "animate-spin" : ""}`} />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-90">
              {t("Afya ya mfumo", "System health")}
            </div>
            <div className="font-display text-2xl font-bold">
              {overall === "ok" && t("Kila kitu kinafanya kazi", "All systems operational")}
              {overall === "warn" && t("Kuna mambo ya kuangalia", "Needs attention")}
              {overall === "fail" && t("Kuna hitilafu", "Something is failing")}
              {overall === "pending" && t("Inakagua…", "Checking…")}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {lastRun && (
              <span className="text-xs opacity-90">
                {t("Imekaguliwa", "Checked")} {lastRun.toLocaleTimeString()}
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={running}
              onClick={() => void runChecks()}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${running ? "animate-spin" : ""}`} />
              {t("Kagua tena", "Re-check")}
            </Button>
          </div>
        </div>

        {snapshot && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: t("Mauzo leo", "Sales today"),
                value: `${num(snapshot.today.sales)} · ${tzs(snapshot.today.salesTZS)}`,
              },
              {
                label: t("Makusanyo leo", "Collections today"),
                value: `${num(snapshot.today.collections)} · ${num(snapshot.today.collectionLitres)} L`,
              },
              {
                label: t("Amana leo", "Deposits today"),
                value: num(snapshot.today.deposits),
              },
              {
                label: t("Harakati za stock leo", "Stock movements today"),
                value: num(snapshot.today.movements),
              },
              {
                label: t("Vikumbusho vilivyotumwa leo", "Reminders sent today"),
                value: num(snapshot.today.remindersSent),
              },
              {
                label: t("Siku imefungwa?", "Day locked?"),
                value: snapshot.today.dayLocked ? t("Ndiyo", "Yes") : t("Bado", "Not yet"),
              },
              {
                label: t("Watumiaji hai", "Active users"),
                value: `${num(snapshot.counts.activeProfiles)} / ${num(snapshot.counts.profiles)}`,
              },
              {
                label: t("Wafugaji / Wateja", "Farmers / Customers"),
                value: `${num(snapshot.counts.farmers)} / ${num(snapshot.counts.customers)}`,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl bg-card border border-border p-4 shadow-card"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </div>
                <div className="font-num font-bold mt-1">{kpi.value}</div>
              </div>
            ))}
          </section>
        )}

        {groups.map((g) => {
          const rows = checks.filter((c) => c.group === g.id);
          if (rows.length === 0) return null;
          const GIcon = GROUP_ICONS[g.id] ?? Activity;
          return (
            <section key={g.id} className="rounded-2xl bg-card border border-border p-5">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <GIcon className="h-4 w-4 text-[#1E7C3F]" />
                {g.label}
              </div>
              <ul className="divide-y divide-border">
                {rows.map((c) => {
                  const meta = STATUS_META[c.status];
                  return (
                    <li key={c.id} className="py-3 flex items-start gap-3">
                      <meta.Icon
                        className="h-4 w-4 mt-0.5 shrink-0"
                        style={{ color: meta.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground break-words">{c.detail}</div>
                        {c.hint && c.status !== "ok" && (
                          <div className="text-xs mt-1" style={{ color: meta.color }}>
                            → {c.hint}
                          </div>
                        )}
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                        style={{ background: `${meta.color}1f`, color: meta.color }}
                      >
                        {c.status === "ok"
                          ? t("Sawa", "OK")
                          : c.status === "warn"
                            ? t("Angalia", "Check")
                            : t("Hitilafu", "Fail")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <footer className="text-center text-xs text-muted-foreground py-4">
          African Joy Dairy ·{" "}
          {t(
            "Ukurasa huu unakagua mfumo halisi kila unapofunguliwa.",
            "This page probes the live system every time it opens.",
          )}
        </footer>
      </main>
    </div>
  );
}
