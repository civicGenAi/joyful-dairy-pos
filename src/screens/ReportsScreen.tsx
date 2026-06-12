import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num, L } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
// BACKEND: data now flows through src/lib/data/{reports,recon,sales,farmers,production}.
import {
  useMilkTrend,
  useSalesByCategory,
  useChannelSplit,
  useTopCustomers,
} from "@/lib/data/hooks/reports";
import { useReconForDate } from "@/lib/data/hooks/recon";
import { useSalesByDate } from "@/lib/data/hooks/sales";
import { useFarmers } from "@/lib/data/hooks/farmers";
import { useYieldTrend } from "@/lib/data/hooks/production";
import { todayISO, daysAgoISO, dateLabel } from "@/lib/data/dates";
import { Send, Mail, MessageCircle, Phone, FileText, Eye, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Link } from "@tanstack/react-router";

const GREENS = ["#1E7C3F", "#2F9E44", "#6FBF59", "#8CC63F", "#1D9E75", "#14532D"];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReportsScreen() {
  const { t } = useApp();
  const today = todayISO();
  const [dailyDate, setDailyDate] = useState(today);
  const [weeklyStart, setWeeklyStart] = useState(daysAgoISO(6));
  const [monthlyMonth, setMonthlyMonth] = useState(today.slice(0, 7));
  const [yearlyYear, setYearlyYear] = useState(today.slice(0, 4));
  const [previewing, setPreviewing] = useState<{ recipient: string; channel: string } | null>(null);

  // Daily
  const { data: reconRows = [] } = useReconForDate(dailyDate);
  const { data: dailySales = [] } = useSalesByDate(dailyDate);
  const { data: yieldWeek = [] } = useYieldTrend(7);
  const dailyRevenue = dailySales.reduce((a, s) => a + s.totalTZS, 0);
  const litresSold = reconRows
    .filter((r) => r.unit === "L")
    .reduce((a, r) => a + r.soldCash + r.soldCredit, 0);
  const dailySpoilt = reconRows.reduce((a, r) => a + r.spoilt, 0);
  const lastYield = [...yieldWeek].reverse().find((y) => y.yieldPct && y.yieldPct > 0)?.yieldPct;

  // Weekly
  const weeklyEnd = addDays(weeklyStart, 6);
  const { data: milkTrend = [] } = useMilkTrend(30);
  const { data: weeklyCategory = [] } = useSalesByCategory(weeklyStart, weeklyEnd);
  const { data: weeklyChannel = [] } = useChannelSplit(weeklyStart, weeklyEnd);
  const { data: weeklyTop = [] } = useTopCustomers(weeklyStart, weeklyEnd, 6);
  const { data: farmers = [] } = useFarmers();
  const weekTrend = milkTrend
    .filter((p) => p.date >= weeklyStart && p.date <= weeklyEnd)
    .map((p) => ({
      day: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
      collected: p.collected,
      sold: p.sold,
    }));
  const weeklyRevenue = weeklyCategory.reduce((a, p) => a + p.amountTZS, 0);
  const weeklyLitres = milkTrend
    .filter((p) => p.date >= weeklyStart && p.date <= weeklyEnd)
    .reduce((a, p) => a + p.collected, 0);
  const weeklySpoilt = milkTrend
    .filter((p) => p.date >= weeklyStart && p.date <= weeklyEnd)
    .reduce((a, p) => a + p.spoilt, 0);
  const spoilageRate = weeklyLitres > 0 ? ((weeklySpoilt / weeklyLitres) * 100).toFixed(1) : "0.0";
  const weeklyChannelPie = useMemo(() => {
    const counter = weeklyChannel
      .filter((c) => c.channel === "counter" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const route = weeklyChannel
      .filter((c) => c.channel === "route" && c.payment !== "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const mpesa = weeklyChannel
      .filter((c) => c.payment === "mpesa")
      .reduce((a, c) => a + c.amountTZS, 0);
    const total = counter + route + mpesa || 1;
    return [
      { name: "Counter", value: Math.round((counter / total) * 100) },
      { name: "Route", value: Math.round((route / total) * 100) },
      { name: "M-Pesa", value: Math.round((mpesa / total) * 100) },
    ];
  }, [weeklyChannel]);

  // Monthly
  const monthStart = `${monthlyMonth}-01`;
  const monthEnd = `${monthlyMonth}-31`;
  const { data: monthlyCategory = [] } = useSalesByCategory(monthStart, monthEnd);
  const { data: monthlyTop = [] } = useTopCustomers(monthStart, monthEnd, 1);
  const monthlyRevenue = monthlyCategory.reduce((a, p) => a + p.amountTZS, 0);
  const monthlyLitres = milkTrend
    .filter((p) => p.date >= monthStart && p.date <= monthEnd)
    .reduce((a, p) => a + p.collected, 0);
  const monthlyDays = new Set(monthlyCategory.map((p) => p.date)).size || 1;
  const weeklyBars = useMemo(() => {
    const weeks: Record<string, number> = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
    for (const p of monthlyCategory) {
      const day = Number(p.date.slice(8, 10));
      const w = `W${Math.min(Math.ceil(day / 7), 5)}`;
      weeks[w] += p.amountTZS;
    }
    return Object.entries(weeks)
      .filter(([w, v]) => v > 0 || w !== "W5")
      .map(([w, v]) => ({ w, v }));
  }, [monthlyCategory]);
  const bestDay = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const p of monthlyCategory) byDate[p.date] = (byDate[p.date] ?? 0) + p.amountTZS;
    const sorted = Object.entries(byDate).sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? null;
  }, [monthlyCategory]);
  const topFarmer = farmers.slice().sort((a, b) => b.litresThisCycle - a.litresThisCycle)[0];
  const avgYield = (() => {
    const vals = yieldWeek.map((y) => y.yieldPct).filter((v): v is number => v !== null && v > 0);
    return vals.length ? (vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : "0";
  })();

  // Yearly
  const yearStart = `${yearlyYear}-01-01`;
  const yearEnd = `${yearlyYear}-12-31`;
  const { data: yearlyCategory = [] } = useSalesByCategory(yearStart, yearEnd);
  const yearlyRevenue = yearlyCategory.reduce((a, p) => a + p.amountTZS, 0);
  const yearlyByMonth = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const p of yearlyCategory) {
      const m = p.date.slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + p.amountTZS;
    }
    return Object.keys(byMonth)
      .sort()
      .map((m) => ({
        m: new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" }),
        v: byMonth[m],
      }));
  }, [yearlyCategory]);

  return (
    <AppShell title={t("Ripoti na Uchambuzi", "Reports & analytics")}>
      <Tabs defaultValue="daily">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <TabsList>
            <TabsTrigger value="daily">{t("Kila siku", "Daily")}</TabsTrigger>
            <TabsTrigger value="weekly">{t("Kila wiki", "Weekly")}</TabsTrigger>
            <TabsTrigger value="monthly">{t("Kila mwezi", "Monthly")}</TabsTrigger>
            <TabsTrigger value="yearly">{t("Kila mwaka", "Yearly")}</TabsTrigger>
            <TabsTrigger value="schedule">{t("Ratiba", "Scheduled delivery")}</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <ExportMenu
              formats={["pdf", "excel", "csv"]}
              filename={`report-${dailyDate}`}
              data={() => ({
                title: t("Ripoti ya kila siku", "Daily report"),
                subtitle: dailyDate,
                headers: [
                  "Product",
                  "Unit",
                  "Opening",
                  "Sold cash",
                  "Sold credit",
                  "Spoilt",
                  "Closing",
                ],
                rows: reconRows.map((r) => [
                  r.product,
                  r.unit,
                  r.opening,
                  r.soldCash,
                  r.soldCredit,
                  r.spoilt,
                  r.closing,
                ]),
              })}
            />
          </div>
        </div>

        <TabsContent value="daily">
          <div className="flex items-center gap-2 mb-4">
            <Input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="h-9 w-44 text-sm"
            />
            <Button asChild variant="outline" size="sm">
              <Link to="/report/day-close/$date" params={{ date: dailyDate }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {t("Ripoti ya kufunga", "Day-close report")}
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("Mauzo leo", "Revenue today")}
              value={tzs(dailyRevenue)}
              accent="green"
            />
            <StatCard
              label={t("Litre zilizouzwa", "Litres sold")}
              value={L(litresSold)}
              accent="info"
            />
            <StatCard label={t("Yaliyoharibika", "Spoilt")} value={L(dailySpoilt)} accent="red" />
            <StatCard
              label={t("Yield", "Yield")}
              value={lastYield ? `${Math.round(lastYield)}%` : "·"}
              accent="green"
            />
          </div>

          <SectionCard
            title={`${t("Ripoti ya kila siku", "Daily report")}, ${dateLabel(dailyDate)}`}
          >
            {reconRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t(
                  "Hakuna harakati zilizorekodiwa siku hii.",
                  "No movements recorded for this date.",
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {reconRows.map((p) => (
                  <div
                    key={p.productId}
                    className="rounded-2xl border border-border bg-card overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center justify-between">
                      <span className="font-display font-semibold text-sm">
                        {p.product} ({p.unit})
                      </span>
                      <Pill tone="success">{t("Sawa", "Balanced")}</Pill>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {[
                          [t("Awali", "Opening"), p.opening],
                          [t("Imeuzwa cash", "Sold cash"), p.soldCash],
                          [t("Mkopo", "Credit"), p.soldCredit],
                          [t("Imeharibika", "Spoilt"), p.spoilt, "danger"],
                          [t("Imebakia", "Closing"), p.closing],
                          [
                            t("Jumla siku", "Day total"),
                            p.opening + p.collected + p.produced,
                            "bold",
                          ],
                        ].map(([k, v, tone], i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td
                              className={`py-1.5 px-3 ${tone === "bold" ? "font-bold" : "text-muted-foreground"}`}
                            >
                              {k}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-right font-num ${tone === "bold" ? "font-bold text-[#1E7C3F]" : tone === "danger" ? "text-[#E11B22]" : ""}`}
                            >
                              {num(v as number)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="weekly">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">
              {t("Wiki inayoanza", "Week starting")}
            </span>
            <Input
              type="date"
              value={weeklyStart}
              onChange={(e) => setWeeklyStart(e.target.value)}
              className="h-9 w-44 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("Mauzo wiki", "Weekly revenue")}
              value={tzs(weeklyRevenue)}
              accent="green"
            />
            <StatCard
              label={t("Litre wiki", "Litres collected")}
              value={L(weeklyLitres)}
              accent="info"
            />
            <StatCard
              label={t("Spoilage rate", "Spoilage")}
              value={`${spoilageRate}%`}
              accent="amber"
            />
            <StatCard
              label={t("Wateja active", "Active customers")}
              value={num(weeklyTop.length)}
              accent="green"
            />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard title={t("Mwelekeo wa wiki", "Weekly trend")} className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={weekTrend} margin={{ left: -10 }}>
                    <defs>
                      <linearGradient id="wk" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2F9E44" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#2F9E44" stopOpacity={0} />
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
                    <Tooltip />
                    <Area type="monotone" dataKey="collected" stroke="#1E7C3F" fill="url(#wk)" />
                    <Line type="monotone" dataKey="sold" stroke="#8CC63F" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={t("Njia ya mauzo", "Channel split")}>
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={weeklyChannelPie}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {weeklyChannelPie.map((_, i) => (
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
          <div className="mt-4 grid lg:grid-cols-2 gap-4">
            <SectionCard title={t("Wateja wa juu, wiki", "Top customers, week")}>
              <table className="w-full text-sm">
                <tbody>
                  {weeklyTop.map((c, i) => (
                    <tr key={c.name} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 font-num text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{c.name}</td>
                      <td className="py-2 px-3 text-right font-num font-semibold">
                        {tzs(c.amountTZS)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
            <SectionCard title={t("Wafugaji wa juu, wiki", "Top farmers, week")}>
              <table className="w-full text-sm">
                <tbody>
                  {farmers
                    .slice()
                    .sort((a, b) => b.litresThisCycle - a.litresThisCycle)
                    .slice(0, 6)
                    .map((f, i) => (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 font-num text-xs text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-2 px-3 font-medium">{f.name}</td>
                        <td className="py-2 px-3 text-right font-num font-semibold">
                          {L(Math.round(f.litresThisCycle / 2))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">{t("Mwezi", "Month")}</span>
            <Select value={monthlyMonth} onValueChange={setMonthlyMonth}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  const m = d.toISOString().slice(0, 7);
                  return (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("Mapato mwezi", "Month revenue")}
              value={tzs(monthlyRevenue)}
              accent="green"
            />
            <StatCard
              label={t("Litre mwezi", "Month litres")}
              value={L(monthlyLitres)}
              accent="info"
            />
            <StatCard
              label={t("Wafugaji active", "Farmers active")}
              value={num(farmers.length)}
              accent="green"
            />
            <StatCard
              label={t("Mauzo wastani siku", "Avg daily sales")}
              value={tzs(Math.round(monthlyRevenue / monthlyDays))}
              accent="info"
            />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard title={t("Mauzo kwa wiki", "Sales by week")} className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={weeklyBars}>
                    <CartesianGrid stroke="#E6EBE1" vertical={false} />
                    <XAxis dataKey="w" stroke="#6B776E" fontSize={11} />
                    <YAxis
                      stroke="#6B776E"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                    />
                    <Tooltip formatter={(v: number) => tzs(v)} />
                    <Bar dataKey="v" fill="#2F9E44" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={t("Mafanikio", "Highlights")}>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("Mauzo bora ya siku", "Best sales day")}
                  </span>
                  <span className="font-num font-semibold">
                    {bestDay ? `${dateLabel(bestDay[0])}, ${tzs(bestDay[1])}` : "·"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Mteja wa juu", "Top customer")}</span>
                  <span className="font-semibold">{monthlyTop[0]?.name ?? "·"}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Mfugaji wa juu", "Top farmer")}</span>
                  <span className="font-semibold">{topFarmer?.name ?? "·"}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Yield wastani", "Avg yield")}</span>
                  <span className="font-num">{avgYield}%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Spoilage rate", "Spoilage")}</span>
                  <span className="font-num">{spoilageRate}%</span>
                </li>
              </ul>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="yearly">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">{t("Mwaka", "Year")}</span>
            <Select value={yearlyYear} onValueChange={setYearlyYear}>
              <SelectTrigger className="h-9 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 3 }).map((_, i) => {
                  const y = String(new Date().getFullYear() - i);
                  return (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t(`Mapato ${yearlyYear}`, "Revenue YTD")}
              value={tzs(yearlyRevenue)}
              accent="green"
            />
            <StatCard
              label={t(`Litre ${yearlyYear}`, "Litres YTD")}
              value={L(monthlyLitres)}
              accent="info"
            />
            <StatCard
              label={t("Miezi yenye mauzo", "Months with sales")}
              value={num(yearlyByMonth.length)}
              accent="green"
            />
            <StatCard
              label={t("Yield wastani", "Avg yield")}
              value={`${avgYield}%`}
              accent="amber"
            />
          </div>
          <SectionCard title={t("Mapato kwa mwezi", "Revenue by month")}>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={yearlyByMonth}>
                  <CartesianGrid stroke="#E6EBE1" vertical={false} />
                  <XAxis dataKey="m" stroke="#6B776E" fontSize={11} />
                  <YAxis
                    stroke="#6B776E"
                    fontSize={11}
                    tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                  />
                  <Tooltip formatter={(v: number) => tzs(v)} />
                  <Line
                    dataKey="v"
                    stroke="#1E7C3F"
                    strokeWidth={3}
                    dot={{ fill: "#2F9E44", r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard
              title={t("Utumaji wa ripoti otomatiki", "Scheduled report delivery")}
              className="lg:col-span-2"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Mpokeaji", "Recipient")}</th>
                    <th>{t("Njia", "Channel")}</th>
                    <th>{t("Kila siku", "Daily")}</th>
                    <th>{t("Kila wiki", "Weekly")}</th>
                    <th>{t("Kila mwezi", "Monthly")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Joyce Mollel (Owner)", ch: "WhatsApp", icon: MessageCircle },
                    { name: "Asha Mwakasege (Finance)", ch: "Email", icon: Mail },
                    { name: "Daudi Massawe (Production)", ch: "WhatsApp", icon: MessageCircle },
                    { name: "Board reports", ch: "Email", icon: Mail },
                    { name: "Field SMS digest", ch: "SMS", icon: Phone },
                  ].map((r) => (
                    <tr key={r.name} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-medium">{r.name}</td>
                      <td className="py-2.5">
                        <Pill tone="info">
                          <r.icon className="h-3 w-3" /> {r.ch}
                        </Pill>
                      </td>
                      <td className="py-2.5">
                        <Switch defaultChecked />
                      </td>
                      <td className="py-2.5">
                        <Switch defaultChecked />
                      </td>
                      <td className="py-2.5">
                        <Switch defaultChecked={r.name.includes("Board")} />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setPreviewing({ recipient: r.name, channel: r.ch })}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {t("Hakikisho", "Preview")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              toast.success(t(`Imetumwa kwa ${r.ch}`, `Sent via ${r.ch}`))
                            }
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            {t("Tuma sasa", "Send")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>

            <SectionCard title={t("Hakikisho la ripoti", "Report preview")}>
              {!previewing ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  {t(
                    "Bofya Hakikisho kwenye mtu yeyote ili kuona ripoti kabla ya kutuma.",
                    "Click Preview on any recipient to see the report before sending.",
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {previewing.channel}
                      </div>
                      <div className="font-semibold text-sm">{previewing.recipient}</div>
                    </div>
                    <button
                      onClick={() => setPreviewing(null)}
                      className="rounded-md p-1.5 hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs space-y-1.5 font-num">
                    <div className="font-display font-bold text-sm">
                      {previewing.channel === "SMS"
                        ? "AFR JOY DAILY"
                        : t("Muhtasari wa siku, African Joy", "Daily summary, African Joy")}
                    </div>
                    <div>{dateLabel(today)}</div>
                    <div>
                      {t("Mauzo", "Sales")}: {tzs(dailyRevenue)}
                    </div>
                    <div>
                      {t("Litre", "Litres")}: {num(litresSold)} L
                    </div>
                    <div>
                      {t("Yaliyoharibika", "Spoilt")}: {num(dailySpoilt)} L
                    </div>
                    <div>
                      {t("Wateja wa juu", "Top customer")}: {weeklyTop[0]?.name ?? "·"}
                    </div>
                    <div>
                      {t("Hali ya siku", "Day")}: {t("Imefunguliwa", "Open")}
                    </div>
                    {previewing.channel === "SMS" ? null : (
                      <div className="pt-2 mt-2 border-t border-border text-[10px] text-muted-foreground">
                        {t(
                          "Ripoti kamili ipo kwenye PDF iliyoambatishwa.",
                          "Full report attached as PDF.",
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() =>
                      toast.success(
                        t(`Imetumwa kwa ${previewing.channel}`, `Sent via ${previewing.channel}`),
                      )
                    }
                    className="w-full mt-3 text-white"
                    style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {t("Tuma sasa", "Send now")}
                  </Button>
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
