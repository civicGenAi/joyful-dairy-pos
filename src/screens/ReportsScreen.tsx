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
import {
  MILK_TREND_30,
  SALES_CHANNEL_SPLIT,
  TOP_CUSTOMERS,
  FARMERS,
  TODAY,
  TODAY_LABEL,
} from "@/mock/data";
import { Send, Mail, MessageCircle, Phone, FileText, Eye, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Link } from "@tanstack/react-router";

const PRODUCT_BLOCKS = [
  {
    name: "Fresh milk (L)",
    opening: 60,
    sold: 380,
    credit: 120,
    spoilt: 12,
    closing: 94,
    total: 940,
  },
  { name: "Mtindi (L)", opening: 40, sold: 110, credit: 80, spoilt: 4, closing: 60, total: 260 },
  { name: "Yoghurt (pcs)", opening: 84, sold: 38, credit: 12, spoilt: 1, closing: 33, total: 120 },
  { name: "Ghee (L)", opening: 18, sold: 1, credit: 0, spoilt: 0, closing: 23, total: 24 },
  { name: "Butter (pcs)", opening: 12, sold: 12, credit: 0, spoilt: 0, closing: 0, total: 24 },
  { name: "Mozzarella (kg)", opening: 2, sold: 8, credit: 2, spoilt: 0, closing: 12, total: 22 },
  { name: "Halloumi (kg)", opening: 1, sold: 2, credit: 1, spoilt: 0, closing: 4.2, total: 7.35 },
  { name: "Paneer (kg)", opening: 0, sold: 0, credit: 1, spoilt: 0, closing: 7, total: 8 },
];

const GREENS = ["#1E7C3F", "#2F9E44", "#6FBF59", "#8CC63F", "#1D9E75", "#14532D"];

export function ReportsScreen() {
  const { t } = useApp();
  const [dailyDate, setDailyDate] = useState(TODAY);
  const [weeklyStart, setWeeklyStart] = useState("2026-05-22");
  const [monthlyMonth, setMonthlyMonth] = useState("2026-05");
  const [yearlyYear, setYearlyYear] = useState("2026");
  const [previewing, setPreviewing] = useState<{ recipient: string; channel: string } | null>(null);

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
            <ExportMenu formats={["pdf", "excel"]} filename="report" />
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
            <StatCard label={t("Mauzo leo", "Revenue today")} value={tzs(1428000)} accent="green" />
            <StatCard label={t("Litre zilizouzwa", "Litres sold")} value={L(520)} accent="info" />
            <StatCard label={t("Yaliyoharibika", "Spoilt")} value={L(17)} accent="red" />
            <StatCard label={t("Yield", "Yield")} value="84%" accent="green" />
          </div>

          <SectionCard
            title={`${t("Ripoti ya kila siku", "Daily report")}, ${dailyDate === TODAY ? TODAY_LABEL : dailyDate}`}
          >
            <div className="grid md:grid-cols-2 gap-3">
              {PRODUCT_BLOCKS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center justify-between">
                    <span className="font-display font-semibold text-sm">{p.name}</span>
                    <Pill tone="success">{t("Sawa", "Balanced")}</Pill>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        [t("Awali", "Opening"), p.opening],
                        [t("Imeuzwa cash", "Sold cash"), p.sold],
                        [t("Mkopo", "Credit"), p.credit],
                        [t("Imeharibika", "Spoilt"), p.spoilt, "danger"],
                        [t("Imebakia", "Closing"), p.closing],
                        [t("Jumla siku", "Day total"), p.total, "bold"],
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
              value={tzs(9620000)}
              accent="green"
            />
            <StatCard label={t("Litre wiki", "Litres collected")} value={L(6240)} accent="info" />
            <StatCard label={t("Spoilage rate", "Spoilage")} value="1.4%" accent="amber" />
            <StatCard
              label={t("Wateja active", "Active customers")}
              value={num(28)}
              accent="green"
            />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard title={t("Mwelekeo wa wiki", "Weekly trend")} className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={MILK_TREND_30.slice(-7)} margin={{ left: -10 }}>
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
                      data={SALES_CHANNEL_SPLIT}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {SALES_CHANNEL_SPLIT.map((_, i) => (
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
                  {TOP_CUSTOMERS.slice(0, 6).map((c, i) => (
                    <tr key={c.name} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 font-num text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{c.name}</td>
                      <td className="py-2 px-3 text-right font-num font-semibold">
                        {tzs(c.value / 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
            <SectionCard title={t("Wafugaji wa juu, wiki", "Top farmers, week")}>
              <table className="w-full text-sm">
                <tbody>
                  {FARMERS.slice()
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
                {["2026-05", "2026-04", "2026-03", "2026-02", "2026-01"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Mapato Mei", "May revenue")} value={tzs(41200000)} accent="green" />
            <StatCard label={t("Litre Mei", "May litres")} value={L(26800)} accent="info" />
            <StatCard
              label={t("Wafugaji active", "Farmers active")}
              value={num(15)}
              accent="green"
            />
            <StatCard
              label={t("Mauzo wastani siku", "Avg daily sales")}
              value={tzs(1370000)}
              accent="info"
            />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard
              title={t("Mauzo kwa wiki, Mei", "Sales by week, May")}
              className="lg:col-span-2"
            >
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      { w: "W1", v: 8800000 },
                      { w: "W2", v: 10200000 },
                      { w: "W3", v: 9400000 },
                      { w: "W4", v: 12800000 },
                    ]}
                  >
                    <CartesianGrid stroke="#E6EBE1" vertical={false} />
                    <XAxis dataKey="w" stroke="#6B776E" fontSize={11} />
                    <YAxis
                      stroke="#6B776E"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
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
                  <span className="font-num font-semibold">22 Mei, {tzs(1880000)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Mteja wa juu", "Top customer")}</span>
                  <span className="font-semibold">Mamis Bistro</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Mfugaji wa juu", "Top farmer")}</span>
                  <span className="font-semibold">Idda Kirenga</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Yield wastani", "Avg yield")}</span>
                  <span className="font-num">83.6%</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">{t("Spoilage rate", "Spoilage")}</span>
                  <span className="font-num">1.6%</span>
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
                {["2026", "2025", "2024"].map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("Mapato 2026", "Revenue YTD")}
              value={tzs(184500000)}
              accent="green"
            />
            <StatCard label={t("Litre 2026", "Litres YTD")} value={L(126000)} accent="info" />
            <StatCard label={t("Ukuaji", "Growth vs 2025")} value="+22%" accent="green" />
            <StatCard label={t("Yield wastani", "Avg yield")} value="83.4%" accent="amber" />
          </div>
          <SectionCard title={t("Mapato kwa mwezi", "Revenue by month")}>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart
                  data={["Jan", "Feb", "Mar", "Apr", "May"].map((m, i) => ({
                    m,
                    v: 28000000 + i * 3300000 + i * i * 500000,
                  }))}
                >
                  <CartesianGrid stroke="#E6EBE1" vertical={false} />
                  <XAxis dataKey="m" stroke="#6B776E" fontSize={11} />
                  <YAxis
                    stroke="#6B776E"
                    fontSize={11}
                    tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
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
                    <div>{TODAY_LABEL}</div>
                    <div>
                      {t("Mauzo", "Sales")}: {tzs(1428000)}
                    </div>
                    <div>{t("Litre", "Litres")}: 520 L</div>
                    <div>{t("Yaliyoharibika", "Spoilt")}: 17 L</div>
                    <div>{t("Wateja wa juu", "Top customer")}: Mamis Bistro</div>
                    <div>
                      {t("Hali ya siku", "Day")}: {t("Imefungwa", "Locked")}
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
