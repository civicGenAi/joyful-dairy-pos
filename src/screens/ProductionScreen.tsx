import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PRODUCTS, YIELD_WEEK } from "@/mock/data";
import { num, L, kg, tzs } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useState } from "react";
import { toast } from "sonner";
import { Factory, Plus, Droplets, Flame } from "lucide-react";

export function ProductionScreen() {
  const { t } = useApp();
  return (
    <AppShell title={t("Uzalishaji", "Production")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Maziwa ghafi yaliyopo", "Raw milk on hand")} value={L(284)} accent="info" />
        <StatCard label={t("Yamepelekwa uzalishaji", "Sent to production")} value={L(580)} accent="green" />
        <StatCard label={t("Yield leo", "Yield today")} value="84%" sub={t("Lengo 85%", "Target 85%")} accent="green" />
        <StatCard label={t("Wastage", "Wastage")} value="3.2%" accent="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <SectionCard title={t("Mpango wa kuzalisha leo", "To produce today")} className="lg:col-span-2"
          action={<RecordBatchDialog />}>
          <ul className="divide-y divide-border">
            {[
              { name: "Mtindi (Mgando)", suggest: "250 L", from: "250 L raw", yield: "100%", cur: 220 },
              { name: "Mozzarella", suggest: "20 kg", from: "244 L raw", yield: "8.2%", cur: 12 },
              { name: "Halloumi", suggest: "6.35 kg", from: "75 L raw", yield: "8.5%", cur: 4.2 },
              { name: "Yoghurt Strawberry", suggest: "60 pcs (500ml)", from: "30 L raw", yield: "100%", cur: 36 },
              { name: "Ghee", suggest: "6 L", from: "Cream 18 L", yield: "33%", cur: 22 },
            ].map((r, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{t("Kutoka", "From")}: {r.from} · yield {r.yield}</div>
                </div>
                <div className="text-right">
                  <div className="font-num font-semibold">{r.suggest}</div>
                  <div className="text-xs text-muted-foreground">{t("Stock sasa", "Now")}: <span className="font-num">{r.cur}</span></div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("Mlolongo wa yield", "Yield trend")}>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={YIELD_WEEK}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis dataKey="day" stroke="#6B776E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B776E" fontSize={11} domain={[70, 95]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="yield" stroke="#1E7C3F" strokeWidth={2.5} dot={{ fill: "#2F9E44", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t("Ubadilishaji wa kilogramu", "kg / litre conversions")}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: "Mozzarella", note: "244 L ≈ 20 kg", color: "#1E7C3F" },
            { name: "Halloumi", note: "75 L ≈ 6.35 kg", color: "#2F9E44" },
            { name: "Paneer", note: "60 L ≈ 5 kg", color: "#6FBF59" },
            { name: "Ghee", note: "18 L cream ≈ 6 L ghee", color: "#E5A100" },
          ].map((x) => (
            <div key={x.name} className="rounded-2xl p-4 border border-border bg-card shadow-card">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: x.color }}><Droplets className="h-3.5 w-3.5" />{x.name}</div>
              <div className="font-num text-xl font-bold mt-1">{x.note}</div>
              <div className="text-xs text-muted-foreground mt-1">{t("Mahesabu ya kweli", "Real plant ratio")}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="mt-5">
        <SectionCard title={t("Bidhaa zilizotengenezwa leo", "Produced today")}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
              <th className="text-right px-3">{t("Imezalishwa", "Produced")}</th>
              <th className="text-right px-3">{t("Inapatikana", "Available")}</th>
              <th className="text-right px-3">{t("Imeharibika", "Spoilt")}</th>
              <th className="px-3">{t("Hali", "Status")}</th>
            </tr></thead>
            <tbody>
              {[
                { p: "Mtindi", produced: 220, avail: 180, rotten: 2, ok: true },
                { p: "Mozzarella", produced: 20, avail: 12, rotten: 0, ok: true },
                { p: "Halloumi", produced: 6.35, avail: 4.2, rotten: 0, ok: true },
                { p: "Ghee", produced: 6, avail: 22, rotten: 0, ok: true },
                { p: "Yoghurt Strawberry", produced: 60, avail: 36, rotten: 1, ok: false },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 px-3 font-medium">{r.p}</td>
                  <td className="py-2.5 px-3 text-right font-num">{num(r.produced)}</td>
                  <td className="py-2.5 px-3 text-right font-num font-semibold">{num(r.avail)}</td>
                  <td className="py-2.5 px-3 text-right font-num text-[#E11B22]">{num(r.rotten)}</td>
                  <td className="py-2.5 px-3"><Pill tone={r.ok ? "success" : "warning"}>{r.ok ? "OK" : t("Angalia", "Check")}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function RecordBatchDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(244);
  const [output, setOutput] = useState(20);
  const yieldPct = ((output * (output > 10 ? 1 : 1) ) / input * 100).toFixed(1);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><Plus className="h-3.5 w-3.5 mr-1" />{t("Rekodi batch", "Record batch")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Factory className="h-4 w-4" />{t("Rekodi batch ya uzalishaji", "Record production batch")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Bidhaa", "Product")}</Label>
            <Select defaultValue="p-mozz"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRODUCTS.filter((p) => p.category === "cheese" || p.category === "yoghurt" || p.category === "cultured" || p.category === "ghee").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Maziwa (L)", "Raw milk (L)")}</Label><Input type="number" value={input} onChange={(e) => setInput(Number(e.target.value))} /></div>
            <div className="grid gap-1.5"><Label>{t("Toleo (kg/pcs)", "Output")}</Label><Input type="number" value={output} onChange={(e) => setOutput(Number(e.target.value))} /></div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("Yield iliyokokotolewa", "Computed yield")}</span>
            <span className="font-num font-bold text-[#1E7C3F]">{yieldPct}%</span>
          </div>
          <div className="grid gap-1.5"><Label>{t("Wastage (L)", "Wastage (L)")}</Label><Input type="number" defaultValue={4} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button><Button onClick={() => { toast.success(t("Batch imerekodiwa", "Batch recorded")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
