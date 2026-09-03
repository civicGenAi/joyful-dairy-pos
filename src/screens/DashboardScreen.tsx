import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { SectionCard, Pill } from "@/components/ui/data-bits";
import { CountUp } from "@/components/ui/CountUp";
// BACKEND: data now flows through src/lib/data/{reports,farmers,customers,stock,recon}.
import {
  useMilkTrend,
  useSalesByCategory,
  useChannelSplit,
  useTopCustomers,
  useAlerts,
} from "@/lib/data/hooks/reports";
import { useFarmers } from "@/lib/data/hooks/farmers";
import { useCustomers } from "@/lib/data/hooks/customers";
import { useStock } from "@/lib/data/hooks/stock";
import { useYieldTrend } from "@/lib/data/hooks/production";
import { useDayLock } from "@/lib/data/hooks/recon";
import { DayLockBanner } from "@/components/shell/DayLockBanner";
import { todayISO, daysAgoISO } from "@/lib/data/dates";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { tzs, L, num } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MapPin,
  Receipt,
  Truck,
  ClipboardCheck,
  Wallet,
  Factory,
  Clock,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ProductShowcase } from "@/components/brand/ProductShowcase";
import { Skeleton } from "@/components/ui/skeleton";
import { KPISkeleton, SectionSkeleton, ChartSkeleton } from "@/components/ui/Skeletons";

const GREENS = ["#1E7C3F", "#2F9E44", "#6FBF59", "#8CC63F", "#1D9E75", "#14532D"];

const CATEGORY_COLUMN: Record<string, string> = {
  "fresh-milk": "Fresh milk",
  cultured: "Mtindi",
  yoghurt: "Yoghurt",
  cheese: "Cheese",
  ghee: "Ghee",
  butter: "Butter",
};

export function DashboardScreen() {
  const { t, lang, role, can } = useApp();
  const today = todayISO();
  const { data: milkTrend = [], isPending } = useMilkTrend(30);
  const { data: channelToday = [] } = useChannelSplit(today, today);
  const { data: channelMonth = [] } = useChannelSplit(daysAgoISO(29), today);
  const { data: categoryWeek = [] } = useSalesByCategory(daysAgoISO(6), today);
  const { data: topCustomers = [] } = useTopCustomers(daysAgoISO(29), today);
  const { data: yieldWeek = [] } = useYieldTrend(7);
  const { data: alerts = [] } = useAlerts();
  const { data: farmers = [] } = useFarmers();
  const { data: customers = [] } = useCustomers();
  const { data: stock = [] } = useStock();
  const { data: dayLock } = useDayLock(today);

  const top = farmers
    .slice()
    .sort((a, b) => b.litresThisCycle - a.litresThisCycle)
    .slice(0, 6);

  // KPI rollups from real data.
  const todayPoint = milkTrend[milkTrend.length - 1];
  const yesterdayPoint = milkTrend[milkTrend.length - 2];
  const collectedToday = todayPoint?.collected ?? 0;
  const spoiltToday = todayPoint?.spoilt ?? 0;
  const collectedDelta =
    yesterdayPoint && yesterdayPoint.collected > 0
      ? ((collectedToday - yesterdayPoint.collected) / yesterdayPoint.collected) * 100
      : 0;
  const salesToday = channelToday.reduce((a, c) => a + c.amountTZS, 0);
  const cashInToday = channelToday
    .filter((c) => c.payment === "cash" || c.payment === "mpesa")
    .reduce((a, c) => a + c.amountTZS, 0);
  const receivable = customers.reduce((a, c) => a + c.outstandingTZS, 0);
  const payable = farmers.reduce((a, f) => a + f.currentBalanceTZS, 0);
  const freshClosing = stock.find((s) => s.id === "s-fresh")?.onHand ?? 0;
  const outCount = stock.filter((s) => s.onHand <= 0).length;

  const milkChart = milkTrend.map((p, i) => ({
    day: `D${i + 1}`,
    collected: p.collected,
    sold: p.sold,
    spoilt: p.spoilt,
  }));

  const channelPie = useMemo(() => {
    const counter = channelMonth
      .filter((c) => c.channel === "counter" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const route = channelMonth
      .filter((c) => c.channel === "route" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const mpesa = channelMonth
      .filter((c) => c.payment === "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const total = counter + route + mpesa || 1;
    return [
      { name: "Counter", value: Math.round((counter / total) * 100) },
      { name: "Route", value: Math.round((route / total) * 100) },
      { name: "M-Pesa", value: Math.round((mpesa / total) * 100) },
    ];
  }, [channelMonth]);

  const categoryChart = useMemo(() => {
    const byDate: Record<string, Record<string, number | string>> = {};
    for (const p of categoryWeek) {
      const day = new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
      });
      byDate[p.date] = byDate[p.date] ?? { day };
      const col = CATEGORY_COLUMN[p.category];
      if (!col) continue;
      byDate[p.date][col] = ((byDate[p.date][col] as number) ?? 0) + p.qty;
    }
    return Object.keys(byDate)
      .sort()
      .map((d) => byDate[d]);
  }, [categoryWeek]);

  const yieldChart = yieldWeek.map((p) => ({
    day: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
    yield: p.yieldPct ?? 0,
  }));
  const avgYield = (() => {
    const vals = yieldWeek.map((p) => p.yieldPct).filter((v): v is number => v !== null && v > 0);
    return vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0;
  })();

  const topCustomersChart = topCustomers.map((c) => ({ name: c.name, value: c.amountTZS }));

  // Stock health: the five items closest to (or past) their reorder level.
  const stockHealth = stock
    .slice()
    .sort((a, b) => a.onHand / Math.max(a.reorder, 1) - b.onHand / Math.max(b.reorder, 1))
    .slice(0, 5);

  // Channel cards for "today".
  const channelCards = useMemo(() => {
    const counter = channelToday
      .filter((c) => c.channel === "counter" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const route = channelToday
      .filter((c) => c.channel === "route" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const mpesa = channelToday
      .filter((c) => c.payment === "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const total = counter + route + mpesa || 1;
    return [
      {
        label: t("Kaunta", "Counter"),
        value: tzs(counter),
        pct: Math.round((counter / total) * 100),
        to: "/pos",
      },
      {
        label: t("Njia", "Route"),
        value: tzs(route),
        pct: Math.round((route / total) * 100),
        to: "/van",
      },
      {
        label: "M-Pesa",
        value: tzs(mpesa),
        pct: Math.round((mpesa / total) * 100),
        to: "/finance",
      },
    ];
  }, [channelToday, t]);

  if (isPending) {
    return (
      <AppShell title={t("Dashibodi", "Dashboard")}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-6 w-48" />
        </div>
        <KPISkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8" />
        <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mt-5">
          <SectionSkeleton>
            <ChartSkeleton />
          </SectionSkeleton>
          <SectionSkeleton>
            <ChartSkeleton />
          </SectionSkeleton>
          <SectionSkeleton>
            <ChartSkeleton />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Dashibodi", "Dashboard")}>
      <DayLockBanner />
      {/* Date + live clock strip, compact */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <LiveDateTime />
        <div className="flex flex-wrap gap-1.5">
          {dayLock ? (
            <Pill tone="info">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />{" "}
              {t("Siku imefungwa", "Day locked")}
            </Pill>
          ) : (
            <Pill tone="success">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F9E44]" />{" "}
              {t("Siku imefunguliwa", "Day open")}
            </Pill>
          )}
          <Pill tone="info">{t("Salio sawa", "Balanced")}</Pill>
          <Pill tone="slate">
            {t("Jukumu", "Role")}, {role}
          </Pill>
        </div>
      </div>

      {/* Compact stat tiles, on top, replacing the hero */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-2.5 mb-5">
        <MiniStat
          accent="green"
          label={t("Yamekusanywa", "Collected")}
          value={
            <>
              <CountUp value={collectedToday} /> L
            </>
          }
          delta={
            yesterdayPoint
              ? {
                  up: collectedDelta >= 0,
                  text: `${collectedDelta >= 0 ? "+" : ""}${collectedDelta.toFixed(1)}%`,
                }
              : undefined
          }
        />
        <MiniStat
          accent="info"
          label={t("Mauzo", "Sales")}
          value={<CountUp value={salesToday} format={(v) => tzs(v, false)} />}
          sub="TZS"
        />
        <MiniStat
          accent="red"
          label={t("Yameharibika", "Spoilt")}
          value={
            <>
              <CountUp value={spoiltToday} /> L
            </>
          }
        />
        <MiniStat
          accent="green"
          label={t("Yamebakia", "Closing")}
          value={
            <>
              <CountUp value={freshClosing} /> L
            </>
          }
        />
        <MiniStat
          accent="green"
          label={t("Cash benki", "Cash in")}
          value={<CountUp value={cashInToday} format={(v) => tzs(v, false)} />}
          sub="TZS"
        />
        <MiniStat
          accent="amber"
          label={t("Madeni", "Receivable")}
          value={<CountUp value={receivable} format={(v) => tzs(v, false)} />}
          sub="TZS"
        />
        <MiniStat
          accent="info"
          label={t("Wafugaji", "Payables")}
          value={<CountUp value={payable} format={(v) => tzs(v, false)} />}
          sub="TZS"
        />
        <MiniStat
          accent="red"
          label={t("Tahadhari", "Alerts")}
          value={<CountUp value={alerts.length} />}
          sub={t(`${outCount} nje`, `${outCount} out`)}
        />
      </div>

      {/* Quick actions, capability-aware. Compact pill row, scrolls horizontally on mobile. */}
      <div className="flex flex-wrap gap-2 mb-5">
        <QuickAction
          to="/farmers"
          icon={MapPin}
          label={t("Rekodi ukusanyaji", "Record collection")}
          show={can("collection:write")}
        />
        <QuickAction
          to="/pos"
          icon={Receipt}
          label={t("Mauzo mapya", "New sale")}
          show={can("pos:use")}
        />
        <QuickAction
          to="/van"
          icon={Truck}
          label={t("Anza njia", "Start route")}
          show={can("route:use")}
        />
        <QuickAction
          to="/production"
          icon={Factory}
          label={t("Rekodi batch", "Record batch")}
          show={can("production:write")}
        />
        <QuickAction
          to="/reconciliation"
          icon={ClipboardCheck}
          label={t("Funga siku", "Lock day")}
          show={can("day:lock")}
        />
        <QuickAction
          to="/finance"
          icon={Wallet}
          label={t("Risiti mpya", "New receipt")}
          show={can("deposit:write")}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <SectionCard
          title={t("Mwendo wa maziwa, siku 30", "Milk movement, last 30 days")}
          className="lg:col-span-2"
        >
          <div className="h-56 sm:h-64">
            <ResponsiveContainer>
              <AreaChart data={milkChart} margin={{ left: -10, right: 5 }}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2F9E44" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2F9E44" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8CC63F" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#8CC63F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6B776E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EBE1" }} />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stroke="#1E7C3F"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
                <Area
                  type="monotone"
                  dataKey="sold"
                  stroke="#8CC63F"
                  strokeWidth={2}
                  fill="url(#g2)"
                />
                <Line
                  type="monotone"
                  dataKey="spoilt"
                  stroke="#E11B22"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t("Njia ya mauzo", "Sales channel split")}>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={channelPie}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {channelPie.map((_, i) => (
                    <Cell key={i} fill={GREENS[i]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <SectionCard
          title={t("Mauzo kwa kategoria, wiki", "Sales by category, week")}
          className="lg:col-span-2"
        >
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={categoryChart} margin={{ left: -10 }}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6B776E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
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

        <SectionCard title={t("Yield wiki hii", "Yield this week")}>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={yieldChart}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6B776E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6B776E"
                  fontSize={11}
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="yield"
                  stroke="#1E7C3F"
                  strokeWidth={3}
                  dot={{ fill: "#2F9E44", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t(`Wastani ${avgYield}%, lengo 85%`, `Average ${avgYield}%, target 85%`)}
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        <SectionCard
          title={t("Wateja wakubwa, mwezi", "Top customers, this month")}
          className="lg:col-span-2"
        >
          <div className="h-64 sm:h-72">
            <ResponsiveContainer>
              <BarChart data={topCustomersChart} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#E6EBE1" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6B776E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6B776E"
                  fontSize={11}
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v: number) => tzs(v)} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="value" fill="#2F9E44" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-[#E11B22]" /> {t("Arifa", "Alerts")}
            </span>
          }
        >
          <ul className="space-y-1">
            {alerts.slice(0, 5).map((a) => {
              const to =
                a.kind === "low-stock"
                  ? "/stock"
                  : a.kind === "overdue-credit"
                    ? "/customers"
                    : a.kind === "farmer-payable"
                      ? "/farmers"
                      : "/reconciliation";
              return (
                <li key={a.id}>
                  <Link
                    to={to}
                    className="flex items-start gap-2 -mx-1 px-1 py-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                  >
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${a.severity === "danger" ? "bg-[#E11B22]" : a.severity === "warning" ? "bg-[#E5A100]" : "bg-[#1D9E75]"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{a.detail}</div>
                    </div>
                    <Pill
                      tone={
                        a.severity === "danger"
                          ? "danger"
                          : a.severity === "warning"
                            ? "warning"
                            : "info"
                      }
                    >
                      {a.timeAgo}
                    </Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
        <SectionCard
          title={t("Wafugaji bora mwezi huu", "Top farmers this month")}
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-border">
            {top.map((f, i) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {f.village}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num text-sm font-semibold">{L(f.litresThisCycle)}</div>
                  <div className="font-num text-[11px] text-muted-foreground">
                    {tzs(f.litresThisCycle * f.ratePerL)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("Hali ya stock", "Stock health")}>
          <div className="space-y-3">
            {stockHealth.map((s) => {
              const tone =
                s.onHand <= 0
                  ? ("danger" as const)
                  : s.onHand < s.reorder
                    ? ("warning" as const)
                    : ("success" as const);
              const max = Math.max(s.reorder * 2, s.onHand, 1);
              return (
                <Link key={s.id} to="/stock" className="block group">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="group-hover:text-foreground">{s.name}</span>
                    <Pill tone={tone}>{num(s.onHand)}</Pill>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tone === "danger" ? "bg-[#E11B22]" : tone === "warning" ? "bg-[#E5A100]" : "bg-[#2F9E44]"}`}
                      style={{ width: `${Math.max(4, (s.onHand / max) * 100)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Product showcase, clean rotating photos */}
      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
        <SectionCard
          title={t("Bidhaa zetu", "Our products")}
          className="lg:col-span-1"
          action={
            <Link to="/products" className="text-xs font-semibold text-[#1E7C3F] hover:underline">
              {t("Tazama zote", "View all")}
            </Link>
          }
        >
          <ProductShowcase aspect="aspect-[4/3]" interval={3000} />
        </SectionCard>

        <SectionCard
          title={t("Mauzo kwa njia, leo", "Sales by channel, today")}
          className="lg:col-span-2"
        >
          <div className="grid sm:grid-cols-3 gap-3">
            {channelCards.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className="rounded-2xl border border-border bg-card p-4 hover:shadow-card hover:border-[#2F9E44] transition"
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {c.label}
                </div>
                <div className="font-num text-lg font-bold mt-1">{c.value}</div>
                <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${c.pct}%`,
                      background: "linear-gradient(90deg, #1E7C3F, #8CC63F)",
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{c.pct}%</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function LiveDateTime() {
  const { lang, t } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(lang === "sw" ? "sw-TZ" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-card shrink-0"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-lg sm:text-xl font-bold leading-tight truncate">
          {dateLabel}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-num tabular-nums">{timeLabel}</span>
          <span className="hidden sm:inline">· {t("Arusha", "Arusha")}</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  delta,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: { up: boolean; text: string };
  accent?: "green" | "red" | "amber" | "info";
}) {
  const bar: Record<string, string> = {
    green: "from-[#1E7C3F] to-[#8CC63F]",
    red: "from-[#E11B22] to-[#ff7a7e]",
    amber: "from-[#E5A100] to-[#ffd166]",
    info: "from-[#1D9E75] to-[#6FBF59]",
  };
  return (
    <div className="relative rounded-xl bg-card border border-border shadow-card p-2.5 sm:p-3 overflow-hidden">
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${bar[accent ?? "green"]}`}
      />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
        {label}
      </div>
      <div className="font-num text-base sm:text-lg font-bold mt-0.5 text-foreground tabular-nums truncate">
        {value}
        {sub && <span className="text-[10px] font-semibold text-muted-foreground ml-1">{sub}</span>}
      </div>
      {delta && (
        <div
          className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${delta.up ? "text-[#1E7C3F]" : "text-[#1E7C3F]"}`}
        >
          {delta.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta.text}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  show,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card hover:shadow-elevated hover:border-[#2F9E44] transition"
    >
      <span
        className="grid h-7 w-7 place-items-center rounded-lg text-white shrink-0"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </Link>
  );
}
