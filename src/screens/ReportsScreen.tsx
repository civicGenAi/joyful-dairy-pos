import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num, L, kg } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { MILK_TREND_30 } from "@/mock/data";
import { Download, FileSpreadsheet, FileText, Send, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";

const PRODUCT_BLOCKS = [
  { name: "Fresh milk (L)", opening: 60, sold: 380, credit: 120, spoilt: 12, closing: 94, total: 940 },
  { name: "Mtindi (L)", opening: 40, sold: 110, credit: 80, spoilt: 4, closing: 60, total: 260 },
  { name: "Yoghurt (pcs)", opening: 84, sold: 38, credit: 12, spoilt: 1, closing: 33, total: 120 },
  { name: "Ghee (L)", opening: 18, sold: 1, credit: 0, spoilt: 0, closing: 23, total: 24 },
  { name: "Butter (pcs)", opening: 12, sold: 12, credit: 0, spoilt: 0, closing: 0, total: 24 },
  { name: "Mozzarella (kg)", opening: 2, sold: 8, credit: 2, spoilt: 0, closing: 12, total: 22 },
  { name: "Halloumi (kg)", opening: 1, sold: 2, credit: 1, spoilt: 0, closing: 4.2, total: 7.35 },
  { name: "Paneer (kg)", opening: 0, sold: 0, credit: 1, spoilt: 0, closing: 7, total: 8 },
];

export function ReportsScreen() {
  const { t } = useApp();
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Mauzo leo", "Revenue today")} value={tzs(1428000)} accent="green" />
            <StatCard label={t("Litre zilizouzwa", "Litres sold")} value={L(520)} accent="info" />
            <StatCard label={t("Yaliyoharibika", "Spoilt")} value={L(17)} accent="red" />
            <StatCard label={t("Yield", "Yield")} value="84%" accent="green" />
          </div>

          <SectionCard title={t("Ripoti ya kila siku, 28 Mei 2026", "Daily report, 28 May 2026")}>
            <div className="grid md:grid-cols-2 gap-3">
              {PRODUCT_BLOCKS.map((p) => (
                <div key={p.name} className="rounded-2xl border border-border bg-card overflow-hidden">
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
                          <td className={`py-1.5 px-3 ${tone === "bold" ? "font-bold" : "text-muted-foreground"}`}>{k}</td>
                          <td className={`py-1.5 px-3 text-right font-num ${tone === "bold" ? "font-bold text-[#1E7C3F]" : tone === "danger" ? "text-[#E11B22]" : ""}`}>{num(v as number)}</td>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Mauzo wiki", "Weekly revenue")} value={tzs(9620000)} accent="green" />
            <StatCard label={t("Litre wiki", "Litres collected")} value={L(6240)} accent="info" />
            <StatCard label={t("Spoilage rate", "Spoilage")} value="1.4%" accent="amber" />
            <StatCard label={t("Wateja active", "Active customers")} value={num(28)} accent="green" />
          </div>
          <SectionCard title={t("Mwelekeo wa wiki", "Weekly trend")}>
            <div className="h-72"><ResponsiveContainer><AreaChart data={MILK_TREND_30.slice(-7)} margin={{ left: -10 }}>
              <defs><linearGradient id="wk" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2F9E44" stopOpacity={0.4} /><stop offset="100%" stopColor="#2F9E44" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#E6EBE1" vertical={false} /><XAxis dataKey="day" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Area type="monotone" dataKey="collected" stroke="#1E7C3F" fill="url(#wk)" /><Line type="monotone" dataKey="sold" stroke="#8CC63F" /></AreaChart></ResponsiveContainer></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Mapato Mei", "May revenue")} value={tzs(41200000)} accent="green" />
            <StatCard label={t("Litre Mei", "May litres")} value={L(26800)} accent="info" />
            <StatCard label={t("Wafugaji active", "Farmers active")} value={num(15)} accent="green" />
            <StatCard label={t("Mauzo wastani siku", "Avg daily sales")} value={tzs(1370000)} accent="info" />
          </div>
          <SectionCard title={t("Mauzo kwa wiki, Mei", "Sales by week, May")}>
            <div className="h-72"><ResponsiveContainer><BarChart data={[{ w: "W1", v: 8800000 }, { w: "W2", v: 10200000 }, { w: "W3", v: 9400000 }, { w: "W4", v: 12800000 }]}><CartesianGrid stroke="#E6EBE1" vertical={false} /><XAxis dataKey="w" stroke="#6B776E" fontSize={11} /><YAxis stroke="#6B776E" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => tzs(v)} /><Bar dataKey="v" fill="#2F9E44" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="yearly">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Mapato 2026", "Revenue YTD")} value={tzs(184500000)} accent="green" />
            <StatCard label={t("Litre 2026", "Litres YTD")} value={L(126000)} accent="info" />
            <StatCard label={t("Ukuaji", "Growth vs 2025")} value="+22%" accent="green" />
            <StatCard label={t("Yield wastani", "Avg yield")} value="83.4%" accent="amber" />
          </div>
          <SectionCard title={t("Mapato kwa mwezi", "Revenue by month")}>
            <div className="h-72"><ResponsiveContainer><LineChart data={["Jan","Feb","Mar","Apr","May"].map((m, i) => ({ m, v: 28000000 + i * 3300000 + (i * i) * 500000 }))}><CartesianGrid stroke="#E6EBE1" vertical={false} /><XAxis dataKey="m" stroke="#6B776E" fontSize={11} /><YAxis stroke="#6B776E" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} /><Tooltip formatter={(v: number) => tzs(v)} /><Line dataKey="v" stroke="#1E7C3F" strokeWidth={3} dot={{ fill: "#2F9E44", r: 5 }} /></LineChart></ResponsiveContainer></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="schedule">
          <SectionCard title={t("Utumaji wa ripoti otomatiki", "Scheduled report delivery")}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Mpokeaji", "Recipient")}</th><th>{t("Njia", "Channel")}</th><th>{t("Kila siku", "Daily")}</th><th>{t("Kila wiki", "Weekly")}</th><th>{t("Kila mwezi", "Monthly")}</th><th /></tr></thead>
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
                    <td className="py-2.5"><Pill tone="info"><r.icon className="h-3 w-3" /> {r.ch}</Pill></td>
                    <td className="py-2.5"><Switch defaultChecked /></td>
                    <td className="py-2.5"><Switch defaultChecked /></td>
                    <td className="py-2.5"><Switch defaultChecked={r.name.includes("Board")} /></td>
                    <td className="py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => toast.success(t("Hakikisho lipo tayari", "Preview ready"))}><Send className="h-3.5 w-3.5 mr-1" />{t("Tuma sasa", "Send now")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
