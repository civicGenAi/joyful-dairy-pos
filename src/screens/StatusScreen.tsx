import { JoyLogo } from "@/components/brand/JoyLogo";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Health = "operational" | "degraded" | "outage";

const COMPONENTS: { name: string; uptime: number; health: Health }[] = [
  { name: "Web app", uptime: 99.98, health: "operational" },
  { name: "POS", uptime: 99.96, health: "operational" },
  { name: "Reports engine", uptime: 99.82, health: "operational" },
  { name: "Email delivery", uptime: 99.71, health: "degraded" },
  { name: "WhatsApp gateway", uptime: 99.65, health: "operational" },
  { name: "SMS gateway", uptime: 99.42, health: "operational" },
  { name: "M-Pesa payments", uptime: 99.88, health: "operational" },
  { name: "Data sync", uptime: 99.79, health: "operational" },
];

const INCIDENTS = [
  { date: "2026-05-26", component: "Email delivery", note: "Delayed receipts to one mailbox provider for 38 minutes, fully recovered." },
  { date: "2026-05-14", component: "M-Pesa payments", note: "Operator-side maintenance window, queued transactions processed on resume." },
  { date: "2026-04-29", component: "Reports engine", note: "Monthly report build slowed during a database failover, no data loss." },
  { date: "2026-04-08", component: "WhatsApp gateway", note: "Template approval reset by provider, replaced within 2 hours." },
];

function pill(health: Health) {
  if (health === "operational") return { label: "Operational", color: "#1D9E75", Icon: CheckCircle2 };
  if (health === "degraded") return { label: "Degraded", color: "#E5A100", Icon: AlertTriangle };
  return { label: "Outage", color: "#E11B22", Icon: XCircle };
}

export function StatusScreen() {
  const overall: Health = COMPONENTS.some((c) => c.health === "outage")
    ? "outage"
    : COMPONENTS.some((c) => c.health === "degraded")
    ? "degraded"
    : "operational";
  const banner = pill(overall);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 py-4">
          <JoyLogo />
          <Link to="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Back to app →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-6">
        <div className="rounded-2xl p-6 text-white shadow-elevated flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${banner.color}, ${banner.color}cc)` }}>
          <banner.Icon className="h-8 w-8" />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-90">System status</div>
            <div className="font-display text-2xl font-bold">All systems {banner.label.toLowerCase()}</div>
          </div>
          <div className="ml-auto text-xs opacity-90">Last checked {new Date().toLocaleTimeString()}</div>
        </div>

        <section className="rounded-2xl bg-card border border-border p-5">
          <div className="font-semibold mb-4">Service components</div>
          <ul className="divide-y divide-border">
            {COMPONENTS.map((c) => {
              const p = pill(c.health);
              return (
                <li key={c.name} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <p.Icon className="h-4 w-4" style={{ color: p.color }} />
                      <div className="font-medium text-sm">{c.name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-num text-sm font-semibold">{c.uptime.toFixed(2)}%</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: `${p.color}1f`, color: p.color }}>{p.label}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-[2px]">
                    {Array.from({ length: 90 }).map((_, i) => {
                      const bad = (i + c.name.length) % 37 === 0 && c.health !== "operational";
                      const warn = (i + c.name.length) % 23 === 0;
                      const color = bad ? "#E11B22" : warn ? "#E5A100" : "#1D9E75";
                      return <span key={i} className="h-6 flex-1 rounded-[2px]" style={{ background: `${color}cc` }} />;
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1.5">90 days ago, today</div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-card border border-border p-5">
          <div className="font-semibold mb-4">Incident history</div>
          <ul className="divide-y divide-border text-sm">
            {INCIDENTS.map((i) => (
              <li key={i.date + i.component} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{i.component}</div>
                  <div className="text-xs text-muted-foreground font-num">{i.date}</div>
                </div>
                <div className="text-muted-foreground text-sm mt-1">{i.note}</div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="text-center text-xs text-muted-foreground py-4">
          African Joy Dairy · status.africanjoydairy.com · subscribe for incident updates
        </footer>
      </main>
    </div>
  );
}
