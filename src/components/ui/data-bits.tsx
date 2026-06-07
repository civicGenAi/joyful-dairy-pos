import { cn } from "@/lib/utils";

export function Pill({ tone = "slate", children, className }: { tone?: "success" | "warning" | "danger" | "info" | "slate"; children: React.ReactNode; className?: string }) {
  const map: Record<string, string> = {
    success: "pill-success",
    warning: "pill-warning",
    danger: "pill-danger",
    info: "pill-info",
    slate: "pill-slate",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", map[tone], className)}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: "green" | "red" | "amber" | "info" }) {
  const bar: Record<string, string> = {
    green: "from-[#1E7C3F] to-[#8CC63F]",
    red: "from-[#E11B22] to-[#ff7a7e]",
    amber: "from-[#E5A100] to-[#ffd166]",
    info: "from-[#1D9E75] to-[#6FBF59]",
  };
  return (
    <div className="relative rounded-2xl bg-card border border-border shadow-card p-4 overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${bar[accent ?? "green"]}`} />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-num text-2xl font-bold mt-1 text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function SectionCard({ title, action, children, className }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card border border-border shadow-card", className)}>
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 border-b border-border">
        <div className="font-display text-sm font-semibold">{title}</div>
        <div>{action}</div>
      </div>
      <div className="p-4 lg:p-5">{children}</div>
    </div>
  );
}
