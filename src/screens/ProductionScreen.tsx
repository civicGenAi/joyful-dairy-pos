import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PRODUCTS, YIELD_WEEK, TODAY } from "@/mock/data";
import { num, L, kg, tzs } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Factory, Plus, Droplets, Flame, FlaskConical, TriangleAlert, History } from "lucide-react";

interface Batch {
  id: string;
  time: string;
  productId: string;
  productName: string;
  inputL: number;
  output: number;
  unit: string;
  yieldPct: number;
  wastage: number;
}

const SEED_BATCHES: Batch[] = [
  { id: "b1", time: "07:50", productId: "p-mtindi", productName: "Mtindi", inputL: 250, output: 220, unit: "L", yieldPct: 88, wastage: 6 },
  { id: "b2", time: "10:15", productId: "p-mozz", productName: "Mozzarella", inputL: 244, output: 20, unit: "kg", yieldPct: 8.2, wastage: 4 },
  { id: "b3", time: "12:40", productId: "p-hall", productName: "Halloumi", inputL: 75, output: 6.35, unit: "kg", yieldPct: 8.5, wastage: 2 },
  { id: "b4", time: "13:30", productId: "p-ghee", productName: "Ghee", inputL: 18, output: 6, unit: "L", yieldPct: 33, wastage: 0 },
  { id: "b5", time: "15:00", productId: "p-yog-straw", productName: "Yoghurt Strawberry", inputL: 30, output: 60, unit: "pcs", yieldPct: 100, wastage: 1 },
];

export function ProductionScreen() {
  const { t } = useApp();
  const [batches, setBatches] = useState<Batch[]>(SEED_BATCHES);
  const [spoilage, setSpoilage] = useState<{ id: string; time: string; productName: string; qty: number; unit: string; reason: string }[]>([
    { id: "sp1", time: "11:00", productName: "Yoghurt Strawberry", qty: 1, unit: "pcs", reason: "Cap fail" },
    { id: "sp2", time: "14:20", productName: "Cream", qty: 2, unit: "L", reason: "Quality fail" },
  ]);

  const totalRaw = useMemo(() => batches.reduce((a, b) => a + b.inputL, 0), [batches]);
  const totalSpoiled = useMemo(() => spoilage.reduce((a, s) => a + s.qty, 0), [spoilage]);
  const avgYield = batches.length ? Math.round(batches.reduce((a, b) => a + b.yieldPct, 0) / batches.length) : 0;

  return (
    <AppShell title={t("Uzalishaji", "Production")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Maziwa ghafi yaliyopo", "Raw milk on hand")} value={L(284)} accent="info" />
        <StatCard label={t("Yamepelekwa uzalishaji", "Sent to production")} value={L(totalRaw)} sub={`${batches.length} ${t("batches", "batches")}`} accent="green" />
        <StatCard label={t("Yield wastani", "Avg yield")} value={`${avgYield}%`} sub={t("Lengo 85%", "Target 85%")} accent={avgYield >= 85 ? "green" : "amber"} />
        <StatCard label={t("Wastage", "Wastage")} value={`${totalSpoiled} pcs/L`} accent="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <SectionCard
          title={t("Mpango wa kuzalisha leo", "To produce today")}
          className="lg:col-span-2"
          action={
            <div className="flex gap-2">
              <RecordSpoilageDialog onSave={(s) => setSpoilage((xs) => [s, ...xs])} />
              <RecordBatchDialog onSave={(b) => setBatches((xs) => [b, ...xs])} />
            </div>
          }
        >
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

      <div className="mt-5 grid lg:grid-cols-3 gap-4">
        <SectionCard className="lg:col-span-2" title={t("Bidhaa zilizotengenezwa leo", "Produced today")} action={<History className="h-4 w-4 text-muted-foreground" />}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 px-3">{t("Wakati", "Time")}</th>
              <th>{t("Bidhaa", "Product")}</th>
              <th className="text-right px-3">{t("Raw", "Raw")}</th>
              <th className="text-right px-3">{t("Imezalishwa", "Produced")}</th>
              <th className="text-right px-3">Yield</th>
              <th className="text-right px-3">{t("Wastage", "Waste")}</th>
            </tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{b.time}</td>
                  <td className="py-2.5 px-3 font-medium">{b.productName}</td>
                  <td className="py-2.5 px-3 text-right font-num">{num(b.inputL)} L</td>
                  <td className="py-2.5 px-3 text-right font-num font-semibold">{num(b.output)} {b.unit}</td>
                  <td className="py-2.5 px-3 text-right font-num text-[#1E7C3F]">{b.yieldPct.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right font-num text-[#E11B22]">{num(b.wastage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title={t("Yaliyoharibika leo", "Spoilage today")}>
          <ul className="divide-y divide-border">
            {spoilage.length === 0 ? (
              <li className="text-sm text-muted-foreground text-center py-6">{t("Hakuna leo", "None today")}</li>
            ) : spoilage.map((s) => (
              <li key={s.id} className="flex items-start gap-2 py-2.5">
                <TriangleAlert className="h-4 w-4 mt-0.5 text-[#E11B22]" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{s.productName}</div>
                  <div className="text-xs text-muted-foreground">{s.time} · {s.reason}</div>
                </div>
                <div className="font-num font-bold text-[#E11B22]">{num(s.qty)} {s.unit}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function RecordBatchDialog({ onSave }: { onSave: (b: Batch) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("p-mozz");
  const [input, setInput] = useState(244);
  const [output, setOutput] = useState(20);
  const [wastage, setWastage] = useState(4);
  const yieldPct = input > 0 ? (output / input) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
          <Plus className="h-3.5 w-3.5 mr-1" />{t("Rekodi batch", "Record batch")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Factory className="h-4 w-4" />{t("Rekodi batch ya uzalishaji", "Record production batch")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Bidhaa", "Product")}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCTS.filter((p) => p.category === "cheese" || p.category === "yoghurt" || p.category === "cultured" || p.category === "ghee" || p.category === "butter").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Maziwa (L)", "Raw milk (L)")}</Label><Input type="number" value={input} onChange={(e) => setInput(Number(e.target.value))} /></div>
            <div className="grid gap-1.5"><Label>{t("Toleo", "Output")}</Label><Input type="number" value={output} onChange={(e) => setOutput(Number(e.target.value))} /></div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("Yield iliyokokotolewa", "Computed yield")}</span>
            <span className="font-num font-bold text-[#1E7C3F]">{yieldPct.toFixed(1)}%</span>
          </div>
          <div className="grid gap-1.5"><Label>{t("Wastage (L)", "Wastage (L)")}</Label><Input type="number" value={wastage} onChange={(e) => setWastage(Number(e.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => {
            const p = PRODUCTS.find((x) => x.id === productId)!;
            onSave({
              id: `b-${Date.now()}`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              productId, productName: p.name,
              inputL: input, output, unit: p.unit,
              yieldPct, wastage,
            });
            toast.success(t("Batch imerekodiwa", "Batch recorded"));
            setOpen(false);
          }}>{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordSpoilageDialog({ onSave }: { onSave: (s: { id: string; time: string; productName: string; qty: number; unit: string; reason: string }) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("p-cream");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 border-[#E11B22] text-[#E11B22] hover:bg-[#E11B22]/10">
          <TriangleAlert className="h-3.5 w-3.5 mr-1.5" />{t("Rekodi haribika", "Record spoilage")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Rekodi bidhaa iliyoharibika", "Record spoilage")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Bidhaa", "Product")}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>{t("Idadi", "Qty")}</Label><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>{t("Sababu", "Reason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Mfano: ubora hauridhishi, joto, ufungaji", "e.g. quality fail, temperature, packaging")} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => {
            const p = PRODUCTS.find((x) => x.id === productId)!;
            onSave({
              id: `sp-${Date.now()}`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              productName: p.name, qty, unit: p.unit, reason: reason || (t("Haijatajwa", "Not specified")),
            });
            toast.success(t("Imerekodi", "Recorded"));
            setOpen(false);
          }} className="bg-[#E11B22] hover:bg-[#c41319] text-white">{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
