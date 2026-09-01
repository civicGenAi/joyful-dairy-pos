import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
// BACKEND: data now flows through src/lib/data/production + stock + products.
import {
  useBatches,
  useSpoilages,
  useYieldTrend,
  useRecordBatch,
} from "@/lib/data/hooks/production";
import { useProducts } from "@/lib/data/hooks/products";
import { useStock, useRecordSpoilage } from "@/lib/data/hooks/stock";
import { todayISO } from "@/lib/data/dates";
import { num, L } from "@/lib/format";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Factory, Plus, TriangleAlert, History } from "lucide-react";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Product, StockItem } from "@/mock/types";

export function ProductionScreen() {
  const { t, can } = useApp();
  const canWrite = can("production:write");
  const today = todayISO();
  const { data: batches = [], isPending, isError, refetch } = useBatches(today);
  const { data: spoilage = [] } = useSpoilages(today);
  const { data: products = [] } = useProducts();
  const { data: stock = [] } = useStock();
  const { data: yieldTrend = [] } = useYieldTrend(7);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const stockItemName = (id: string) => stock.find((s) => s.id === id)?.name ?? id;
  const stockItemUnit = (id: string) => stock.find((s) => s.id === id)?.unit ?? "";
  const onHandOf = (productId: string) =>
    stock.find((s) => s.productId === productId && s.category === "finished")?.onHand ?? 0;
  // fresh-milk is the internal raw-milk bucket, never something actually
  // produced, everything else is a real product line (Mtindi, cheese, yoghurt).
  const producibleProducts = products.filter((p) => p.category !== "fresh-milk" && p.active);
  const rawOnHand = stock.find((s) => s.id === "raw-milk")?.onHand ?? 0;

  const totalRaw = useMemo(() => batches.reduce((a, b) => a + b.inputLitres, 0), [batches]);
  const totalSpoiled = useMemo(() => spoilage.reduce((a, s) => a + s.qty, 0), [spoilage]);
  const yieldedBatches = batches.filter((b) => b.yieldPct !== null);
  const avgYield = yieldedBatches.length
    ? Math.round(yieldedBatches.reduce((a, b) => a + (b.yieldPct ?? 0), 0) / yieldedBatches.length)
    : 0;

  const yieldChart = yieldTrend.map((p) => ({
    day: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
    yield: p.yieldPct ?? 0,
  }));

  if (isPending) {
    return (
      <AppShell title={t("Uzalishaji", "Production")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={6} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title={t("Uzalishaji", "Production")}>
        <EmptyState
          icon={Factory}
          title={t("Imeshindikana kupakia uzalishaji", "Could not load production")}
          description={t("Tafadhali jaribu tena.", "Please try again.")}
          action={
            <Button onClick={() => refetch()} variant="outline">
              {t("Jaribu tena", "Retry")}
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Uzalishaji", "Production")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Maziwa ghafi yaliyopo", "Raw milk on hand")}
          value={L(rawOnHand)}
          accent="info"
        />
        <StatCard
          label={t("Yamepelekwa uzalishaji", "Sent to production")}
          value={L(totalRaw)}
          sub={`${batches.length} ${t("batches", "batches")}`}
          accent="green"
        />
        <StatCard
          label={t("Yield wastani", "Avg yield")}
          value={`${avgYield}%`}
          sub={t("Lengo 85%", "Target 85%")}
          accent={avgYield >= 85 ? "green" : "amber"}
        />
        <StatCard
          label={t("Wastage", "Wastage")}
          value={`${num(totalSpoiled)} pcs/L`}
          accent="red"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <SectionCard
          title={t("Bidhaa zetu za uzalishaji", "Our production lines")}
          className="lg:col-span-2"
          action={
            canWrite && (
              <div className="flex gap-2">
                <RecordSpoilageDialog stock={stock} />
                <RecordBatchDialog products={products} />
              </div>
            )
          }
        >
          {producibleProducts.length === 0 ? (
            <EmptyState
              icon={Factory}
              title={t("Hakuna bidhaa za uzalishaji bado", "No production products yet")}
              description={t(
                "Ongeza bidhaa katika Bidhaa na Bei.",
                "Add products in Products & Pricing.",
              )}
            />
          ) : (
            <ul className="divide-y divide-border">
              {producibleProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                  </div>
                  <div className="text-right">
                    {p.defaultYieldPct != null ? (
                      <div className="font-num font-semibold text-[#1E7C3F]">
                        {num(p.defaultYieldPct)}% {t("mavuno", "yield")}
                      </div>
                    ) : (
                      <Pill tone="slate">{t("Kwa mkono", "Manual")}</Pill>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("Stock sasa", "Now")}:{" "}
                      <span className="font-num">
                        {num(onHandOf(p.id))} {p.unit}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("Mlolongo wa yield", "Yield trend")}>
          <div className="h-44">
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
                  strokeWidth={2.5}
                  dot={{ fill: "#2F9E44", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid lg:grid-cols-3 gap-4">
        <SectionCard
          className="lg:col-span-2"
          title={t("Bidhaa zilizotengenezwa leo", "Produced today")}
          action={<History className="h-4 w-4 text-muted-foreground" />}
        >
          {batches.length === 0 ? (
            <EmptyState
              icon={Factory}
              title={t("Hakuna batch leo bado", "No batches recorded today yet")}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Wakati", "Time")}</th>
                  <th>{t("Bidhaa", "Product")}</th>
                  <th className="text-right px-3">{t("Raw", "Raw")}</th>
                  <th className="text-right px-3">{t("Imezalishwa", "Produced")}</th>
                  <th className="text-right px-3">Yield</th>
                  <th className="text-right px-3">{t("Wastage", "Waste")}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{b.date}</td>
                    <td className="py-2.5 px-3 font-medium">{productName(b.productId)}</td>
                    <td className="py-2.5 px-3 text-right font-num">{num(b.inputLitres)} L</td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold">
                      {num(b.outputQty)} {b.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-[#1E7C3F]">
                      {b.yieldPct !== null ? `${b.yieldPct.toFixed(1)}%` : "·"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-[#E11B22]">
                      {num(b.wastage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title={t("Yaliyoharibika leo", "Spoilage today")}>
          <ul className="divide-y divide-border">
            {spoilage.length === 0 ? (
              <li className="text-sm text-muted-foreground text-center py-6">
                {t("Hakuna leo", "None today")}
              </li>
            ) : (
              spoilage.map((s) => (
                <li key={s.id} className="flex items-start gap-2 py-2.5">
                  <TriangleAlert className="h-4 w-4 mt-0.5 text-[#E11B22]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{stockItemName(s.stockItemId)}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.date} · {s.reason ?? t("Haijatajwa", "Not specified")}
                    </div>
                  </div>
                  <div className="font-num font-bold text-[#E11B22]">
                    {num(s.qty)} {stockItemUnit(s.stockItemId)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function RecordBatchDialog({ products }: { products: Product[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("p-mozz");
  const [input, setInput] = useState(244);
  const [output, setOutput] = useState(20);
  const [wastage, setWastage] = useState(4);
  const record = useRecordBatch();
  const producible = products.filter(
    (p) =>
      p.category === "cheese" ||
      p.category === "yoghurt" ||
      p.category === "cultured" ||
      p.category === "ghee" ||
      p.category === "butter" ||
      p.category === "cream",
  );
  const selected = producible.find((p) => p.id === productId);
  // Product has a configured yield %: output/wastage compute automatically
  // from input litres, both read-only. No yield configured: fully manual,
  // exactly as before. Recording the batch itself is always a manual click.
  const auto = selected?.defaultYieldPct != null;
  const autoOutput = auto
    ? Math.round(input * (selected!.defaultYieldPct! / 100) * 100) / 100
    : output;
  const autoWastage = auto ? Math.max(input - autoOutput, 0) : wastage;
  const yieldPct = input > 0 ? (autoOutput / input) * 100 : 0;

  const save = () => {
    if (!productId || autoOutput <= 0) return;
    record.mutate(
      auto
        ? { productId, inputLitres: input }
        : { productId, inputLitres: input, outputQty: output, wastage },
      {
        onSuccess: () => {
          toast.success(t("Batch imerekodiwa", "Batch recorded"));
          setOpen(false);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("day-locked")
              ? t("Siku hii imefungwa", "This day is locked")
              : t("Imeshindikana kurekodi batch", "Could not record batch"),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Rekodi batch", "Record batch")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            {t("Rekodi batch ya uzalishaji", "Record production batch")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Bidhaa", "Product")}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {producible.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Maziwa (L)", "Raw milk (L)")}</Label>
              <Input
                type="number"
                step="any"
                value={input}
                onChange={(e) => setInput(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Toleo", "Output")}</Label>
              <Input
                type="number"
                step="any"
                value={auto ? autoOutput : output}
                readOnly={auto}
                disabled={auto}
                onChange={(e) => setOutput(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {auto
                ? t("Mavuno yaliyowekwa", "Configured yield")
                : t("Yield iliyokokotolewa", "Computed yield")}
            </span>
            <span className="font-num font-bold text-[#1E7C3F]">{yieldPct.toFixed(1)}%</span>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Wastage (L)", "Wastage (L)")}</Label>
            <Input
              type="number"
              step="any"
              value={auto ? autoWastage : wastage}
              readOnly={auto}
              disabled={auto}
              onChange={(e) => setWastage(Number(e.target.value))}
            />
            {auto && (
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Kimewekwa kiotomatiki kutoka mavuno % ya bidhaa, kitarekodiwa kama uharibifu.",
                  "Set automatically from the product's yield %, will be recorded as spoilage.",
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={record.isPending}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordSpoilageDialog({ stock }: { stock: StockItem[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const items = stock.filter((s) => s.category === "finished" || s.category === "raw");
  const [itemId, setItemId] = useState("s-cream");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const record = useRecordSpoilage();

  const save = () => {
    const id = items.some((s) => s.id === itemId) ? itemId : items[0]?.id;
    if (!id || qty <= 0) return;
    record.mutate(
      { stockItemId: id, qty, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(t("Imerekodi", "Recorded"));
          setOpen(false);
          setReason("");
        },
        onError: (e) =>
          toast.error(
            e.message.includes("day-locked")
              ? t("Siku hii imefungwa", "This day is locked")
              : t("Imeshindikana kurekodi", "Could not record spoilage"),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-[#E11B22] text-[#E11B22] hover:bg-[#E11B22]/10"
        >
          <TriangleAlert className="h-3.5 w-3.5 mr-1.5" />
          {t("Rekodi haribika", "Record spoilage")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rekodi bidhaa iliyoharibika", "Record spoilage")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Bidhaa", "Product")}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Idadi", "Qty")}</Label>
            <Input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Sababu", "Reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "Mfano: ubora hauridhishi, joto, ufungaji",
                "e.g. quality fail, temperature, packaging",
              )}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={record.isPending}
            className="bg-[#E11B22] hover:bg-[#c41319] text-white"
          >
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
