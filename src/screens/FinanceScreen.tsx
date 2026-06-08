import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { CUSTOMERS, FARMERS } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wallet, Receipt, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";

export function FinanceScreen() {
  const { t } = useApp();
  const receivable = CUSTOMERS.reduce((a, c) => a + c.outstandingTZS, 0);
  const payable = FARMERS.reduce((a, f) => a + f.currentBalanceTZS, 0);

  const ageing = [
    { name: "Current", value: 1700000, color: "#2F9E44" },
    { name: "30 days", value: 1050000, color: "#E5A100" },
    { name: "60 days", value: 580000, color: "#E5A100" },
    { name: "90+ days", value: 350000, color: "#E11B22" },
  ];

  return (
    <AppShell title={t("Fedha", "Finance")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Madeni ya wateja", "Receivables")} value={tzs(receivable)} sub={t("Wateja 12", "12 customers")} accent="amber" />
        <StatCard label={t("Malipo wafugaji", "Farmer payables")} value={tzs(payable)} sub={t("Mzunguko 15-siku · 15 Jun", "15-day cycle · Jun 15")} accent="info" />
        <StatCard label={t("Cash leo", "Cash position today")} value={tzs(1820000)} sub={t("Pamoja na M-Pesa", "Includes M-Pesa")} accent="green" />
        <StatCard label={t("Amana zilizopokelewa", "Deposits received")} value={tzs(640000)} sub={t("Risiti 4", "4 receipts")} accent="green" />
      </div>

      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">{t("Madeni", "Receivables")}</TabsTrigger>
          <TabsTrigger value="payables">{t("Malipo wafugaji", "Farmer payables")}</TabsTrigger>
          <TabsTrigger value="deposits">{t("Amana & Risiti", "Deposits & receipts")}</TabsTrigger>
          <TabsTrigger value="dayclose">{t("Kuthibitisha siku", "Day-close confirmation")}</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard title={t("Muhtasari wa madeni", "Receivables summary")} className="lg:col-span-2" action={<ExportMenu formats={["excel", "csv"]} filename="receivables" />}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Mteja", "Customer")}</th><th>{t("Aina", "Type")}</th><th className="text-right">{t("Deni", "Outstanding")}</th><th>{t("Hali", "Status")}</th></tr></thead>
                <tbody>
                  {CUSTOMERS.filter((c) => c.outstandingTZS > 0).slice(0, 10).map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0"><td className="py-2.5 px-3 font-medium">{c.name}</td><td className="py-2.5"><Pill tone={c.type === "monthly" ? "success" : "warning"}>{c.type}</Pill></td><td className="py-2.5 text-right font-num font-semibold">{tzs(c.outstandingTZS)}</td><td className="py-2.5"><Pill tone={c.status === "overdue" ? "danger" : "info"}>{c.status === "overdue" ? t("Imechelewa", "Overdue") : "OK"}</Pill></td></tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
            <SectionCard title={t("Umri wa madeni", "Ageing")}>
              <div className="h-44"><ResponsiveContainer><PieChart><Pie data={ageing} dataKey="value" innerRadius={45} outerRadius={75}>{ageing.map((a, i) => <Cell key={i} fill={a.color} />)}</Pie><Tooltip formatter={(v: number) => tzs(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="payables" className="mt-4">
          <SectionCard title={t("Malipo yajayo, mzunguko wa siku 15", "Upcoming payouts, 15-day cycle")}>
            <div className="rounded-xl bg-[#1E7C3F]/10 p-4 mb-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#1E7C3F]" />
              <div>
                <div className="font-semibold">{t("Malipo yajayo", "Next payout")}: 15 Jun 2026</div>
                <div className="text-xs text-muted-foreground">{t("Wafugaji 15 · Jumla", "15 farmers · Total")} <span className="font-num font-semibold text-[#14532D]">{tzs(payable)}</span></div>
              </div>
              <Button className="ml-auto text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Malipo yameanzishwa", "Payouts initiated"))}>{t("Anzisha malipo", "Initiate payouts")}</Button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th><th className="text-right">{t("Litre", "Litres")}</th><th className="text-right">{t("Inadaiwa", "Owed")}</th><th>{t("Hali", "Status")}</th></tr></thead>
              <tbody>{FARMERS.slice(0, 10).map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0"><td className="py-2.5 px-3 font-medium">{f.name}</td><td className="py-2.5 text-right font-num">{num(f.litresThisCycle)}</td><td className="py-2.5 text-right font-num font-semibold">{tzs(f.currentBalanceTZS)}</td><td className="py-2.5"><Pill tone={f.status === "delayed" ? "danger" : f.status === "due" ? "warning" : "success"}>{f.status}</Pill></td></tr>
              ))}</tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <SectionCard title={t("Amana zilizopokelewa", "Deposits & receipts log")}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Wakati", "Time")}</th><th>{t("Rejea", "Reference")}</th><th>{t("Chanzo", "Source")}</th><th>{t("Aina", "Type")}</th><th className="text-right">{t("Kiasi", "Amount")}</th><th /></tr></thead>
              <tbody>
                {[
                  { t: "08:15", ref: "RCT-5810", src: "Route van #1, Baraka", k: "Route cash-up", a: 540000 },
                  { t: "10:42", ref: "RCT-5811", src: "Mamis Bistro", k: "Customer deposit", a: 150000 },
                  { t: "12:05", ref: "RCT-5812", src: "POS, counter", k: "Cash banking", a: 320000 },
                  { t: "14:30", ref: "RCT-5813", src: "Jovinary Hotel", k: "Customer deposit", a: 200000 },
                ].map((d) => (
                  <tr key={d.ref} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{d.t}</td>
                    <td className="py-2.5 font-num text-xs">{d.ref}</td>
                    <td className="py-2.5 font-medium">{d.src}</td>
                    <td className="py-2.5"><Pill tone="info">{d.k}</Pill></td>
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(d.a)}</td>
                    <td className="py-2.5 text-right"><Button size="sm" variant="ghost" className="text-xs h-7"><Receipt className="h-3.5 w-3.5 mr-1" />{t("Risiti", "Print")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="dayclose" className="mt-4">
          <SectionCard title={t("Kuthibitisha siku", "Day-close confirmation queue")}>
            <ul className="divide-y divide-border">
              {[
                { date: "2026-05-27", by: "Daudi Massawe", status: "balanced" },
                { date: "2026-05-26", by: "Daudi Massawe", status: "balanced" },
                { date: "2026-05-25", by: "Daudi Massawe", status: "needs-review" },
              ].map((d) => (
                <li key={d.date} className="flex items-center gap-3 py-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${d.status === "balanced" ? "bg-[#2F9E44]/15 text-[#1E7C3F]" : "bg-[#E5A100]/15 text-[#E5A100]"}`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{d.date}</div>
                    <div className="text-xs text-muted-foreground">{t("Imefungwa na", "Locked by")} {d.by}</div>
                  </div>
                  <Pill tone={d.status === "balanced" ? "success" : "warning"}>{d.status}</Pill>
                  <Button size="sm" variant="outline" onClick={() => toast.success(t("Imethibitishwa", "Confirmed"))}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t("Thibitisha", "Confirm")}</Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
