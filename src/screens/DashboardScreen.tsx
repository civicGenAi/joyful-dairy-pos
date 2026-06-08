import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { StatCard, SectionCard, Pill } from "@/components/ui/data-bits";
import { CountUp } from "@/components/ui/CountUp";
import { ALERTS, FARMERS, MILK_TREND_30, SALES_BY_CATEGORY_WEEK, SALES_CHANNEL_SPLIT, TOP_CUSTOMERS, YIELD_WEEK, TODAY } from "@/mock/data";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { tzs, L, num } from "@/lib/format";
import { TrendingUp, TrendingDown, AlertTriangle, MapPin, Receipt, Truck, ClipboardCheck, Wallet, Factory } from "lucide-react";
import { Link } from "@tanstack/react-router";

const GREENS = ["#1E7C3F", "#2F9E44", "#6FBF59", "#8CC63F", "#1D9E75", "#14532D"];

export function DashboardScreen() {
  const { t, lang, user, role, can } = useApp();
  const top = FARMERS.slice().sort((a, b) => b.litresThisCycle - a.litresThisCycle).slice(0, 6);

  return (
    <AppShell title={t("Dashibodi", "Dashboard")}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 text-white shadow-elevated mb-6"
        style={{ background: "linear-gradient(135deg, #14532D 0%, #1E7C3F 35%, #2F9E44 70%, #8CC63F 130%)" }}>
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-10 bottom-0 h-40 w-40 rounded-full bg-[#E11B22]/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">{new Date(TODAY).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            <h2 className="font-display text-2xl lg:text-3xl font-bold mt-1">{t("Habari", "Hello")}, {user?.name.split(" ")[0]} 👋</h2>
            <p className="opacity-90 mt-1 max-w-lg">{t("Karibu kwenye muhtasari wa leo wa African Joy Dairy.", "Here's today's snapshot for African Joy Dairy.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold">{t("Siku", "Day")}: <span className="ml-1 inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#8CC63F]" /> {t("Imefunguliwa", "Open")}</span></span>
            <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold">{t("Salio", "Balance")}: {t("Sawazi", "Balanced")}</span>
            <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold">{t("Jukumu", "Role")}: {role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <QuickAction to="/farmers" icon={MapPin} label={t("Rekodi ukusanyaji", "Record collection")} show={can("collection:write")} />
        <QuickAction to="/pos" icon={Receipt} label={t("Mauzo mapya", "New sale")} show={can("pos:use")} />
        <QuickAction to="/van" icon={Truck} label={t("Anza njia", "Start route")} show={can("route:use")} />
        <QuickAction to="/production" icon={Factory} label={t("Rekodi batch", "Record batch")} show={can("production:write")} />
        <QuickAction to="/reconciliation" icon={ClipboardCheck} label={t("Funga siku", "Lock day")} show={can("day:lock")} />
        <QuickAction to="/finance" icon={Wallet} label={t("Risiti mpya", "New receipt")} show={can("deposit:write")} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label={t("Yaliyokusanywa leo", "Collected today")} value={<><CountUp value={882} /> L</>} sub={<><TrendingUp className="inline h-3 w-3 text-[#2F9E44]" /> +4.2% {t("vs jana", "vs yesterday")}</>} accent="green" />
        <StatCard label={t("Mauzo leo (cash + mkopo)", "Sales today (cash + credit)")} value={<CountUp value={1428000} format={(v) => tzs(v)} />} sub={t("520 L, cash 64% / credit 36%", "520 L, cash 64% / credit 36%")} accent="info" />
        <StatCard label={t("Yaliyoharibika", "Spoilt today")} value={<><CountUp value={12} /> L</>} sub={<><TrendingDown className="inline h-3 w-3 text-[#2F9E44]" /> -1.5 L {t("vs jana", "vs yesterday")}</>} accent="red" />
        <StatCard label={t("Yaliyobaki (closing)", "Closing balance")} value={<><CountUp value={214} /> L</>} sub={t("Imekokotolewa kwa muda halisi", "Computed live")} accent="green" />
        <StatCard label={t("Cash leo", "Cash in till today")} value={<CountUp value={860000} format={(v) => tzs(v)} />} sub={t("Cash 60%, M-Pesa 40%", "Cash 60%, M-Pesa 40%")} accent="green" />
        <StatCard label={t("Madeni ya wateja", "Outstanding receivables")} value={<CountUp value={3680000} format={(v) => tzs(v)} />} sub={t("Wateja 12, 3 wamechelewa", "12 clients, 3 overdue")} accent="amber" />
        <StatCard label={t("Malipo wafugaji", "Farmer payables")} value={<CountUp value={4830000} format={(v) => tzs(v)} />} sub={t("Mzunguko unaomalizika 15 Juni", "Next 15-day cycle: Jun 15")} accent="info" />
        <StatCard label={t("Tahadhari za stock", "Low-stock alerts")} value={<CountUp value={5} />} sub={t("2 nje ya stock, 3 chini", "2 out, 3 low")} accent="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <SectionCard title={t("Mwendo wa maziwa siku 30 zilizopita", "Milk movement, last 30 days")} className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={MILK_TREND_30} margin={{ left: -10, right: 5 }}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2F9E44" stopOpacity={0.5} /><stop offset="100%" stopColor="#2F9E44" stopOpacity={0} /></linearGradient>
                  <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8CC63F" stopOpacity={0.45} /><stop offset="100%" stopColor="#8CC63F" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis dataKey="day" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EBE1" }} />
                <Area type="monotone" dataKey="collected" stroke="#1E7C3F" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="sold" stroke="#8CC63F" strokeWidth={2} fill="url(#g2)" />
                <Line type="monotone" dataKey="spoilt" stroke="#E11B22" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t("Njia ya mauzo", "Sales channel split")}>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={SALES_CHANNEL_SPLIT} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {SALES_CHANNEL_SPLIT.map((_, i) => <Cell key={i} fill={GREENS[i]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <SectionCard title={t("Mauzo kwa kategoria, wiki", "Sales by category, week")} className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={SALES_BY_CATEGORY_WEEK} margin={{ left: -10 }}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis dataKey="day" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EBE1" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Fresh milk" stackId="a" fill="#1E7C3F" />
                <Bar dataKey="Mtindi" stackId="a" fill="#2F9E44" />
                <Bar dataKey="Yoghurt" stackId="a" fill="#6FBF59" />
                <Bar dataKey="Cheese" stackId="a" fill="#8CC63F" />
                <Bar dataKey="Ghee" stackId="a" fill="#1D9E75" />
                <Bar dataKey="Butter" stackId="a" fill="#E5A100" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t("Yield wiki hii", "Production yield this week")}>
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={YIELD_WEEK}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis dataKey="day" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B776E" fontSize={11} domain={[70, 95]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="yield" stroke="#1E7C3F" strokeWidth={3} dot={{ fill: "#2F9E44", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{t("Wastani 83%, lengo 85%", "Average 83%, target 85%")}</div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title={t("Wateja wakubwa, mwezi huu", "Top customers, this month")} className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={TOP_CUSTOMERS} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="#E6EBE1" horizontal={false} />
                <XAxis type="number" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" stroke="#6B776E" fontSize={11} width={120} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => tzs(v)} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="value" fill="#2F9E44" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title={<span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-[#E11B22]" /> {t("Arifa", "Alerts")}</span>}
        >
          <ul className="space-y-1">
            {ALERTS.slice(0, 5).map((a) => {
              const to = a.kind === "low-stock" ? "/stock" : a.kind === "overdue-credit" ? "/customers" : a.kind === "farmer-payable" ? "/farmers" : "/reconciliation";
              return (
                <li key={a.id}>
                  <Link to={to} className="flex items-start gap-2 -mx-1 px-1 py-1.5 rounded-lg hover:bg-accent/60 transition-colors">
                    <span className={`mt-1 h-2 w-2 rounded-full ${a.severity === "danger" ? "bg-[#E11B22]" : a.severity === "warning" ? "bg-[#E5A100]" : "bg-[#1D9E75]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.detail}</div>
                    </div>
                    <Pill tone={a.severity === "danger" ? "danger" : a.severity === "warning" ? "warning" : "info"}>{a.timeAgo}</Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <SectionCard title={t("Wafugaji bora mwezi huu", "Top farmers this month")} className="lg:col-span-2">
          <ul className="divide-y divide-border">
            {top.map((f, i) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {f.village}</div>
                </div>
                <div className="text-right">
                  <div className="font-num text-sm font-semibold">{L(f.litresThisCycle)}</div>
                  <div className="font-num text-[11px] text-muted-foreground">{tzs(f.litresThisCycle * f.ratePerL)}</div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("Hali ya stock", "Stock health")}>
          <div className="space-y-3">
            {[
              { name: "Fresh milk", v: 240, max: 300, tone: "success" as const },
              { name: "Mtindi", v: 180, max: 250, tone: "success" as const },
              { name: "Halloumi", v: 4.2, max: 10, tone: "warning" as const },
              { name: "Butter 250g", v: 0, max: 30, tone: "danger" as const },
              { name: "Vikopo robo", v: 140, max: 300, tone: "warning" as const },
            ].map((s) => (
              <Link key={s.name} to="/stock" className="block group">
                <div className="flex justify-between text-xs mb-1"><span className="group-hover:text-foreground">{s.name}</span><Pill tone={s.tone}>{num(s.v)}</Pill></div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full ${s.tone === "danger" ? "bg-[#E11B22]" : s.tone === "warning" ? "bg-[#E5A100]" : "bg-[#2F9E44]"}`} style={{ width: `${Math.max(4, (s.v / s.max) * 100)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function QuickAction({ to, icon: Icon, label, show }: { to: string; icon: typeof MapPin; label: string; show: boolean }) {
  if (!show) return null;
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-3 shadow-card hover:shadow-elevated transition flex items-center gap-2.5"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl text-white shrink-0" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </Link>
  );
}
