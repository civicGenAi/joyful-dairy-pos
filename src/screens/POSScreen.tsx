import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/{products,customers,stock,sales}.
import { useProducts, usePriceMatrix } from "@/lib/data/hooks/products";
import { useCustomers } from "@/lib/data/hooks/customers";
import { useStock } from "@/lib/data/hooks/stock";
import { useSalesByDate, useCompleteSale, useVoidSale } from "@/lib/data/hooks/sales";
import { todayISO } from "@/lib/data/dates";
import type { Sale } from "@/lib/data/sales";
import type { PriceTier, ProductCategory } from "@/mock/types";
import { tzs, num } from "@/lib/format";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  ShoppingBasket,
  AlertTriangle,
  Receipt as ReceiptIcon,
  History,
  Pause,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import type { Customer, PriceMatrix, Product } from "@/mock/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { DayLockBanner } from "@/components/shell/DayLockBanner";
import { uploadHardCopy } from "@/lib/data/uploads";

const CATS: { id: ProductCategory; label: { sw: string; en: string }; color: string }[] = [
  { id: "fresh-milk", label: { sw: "Maziwa Fresh", en: "Fresh milk" }, color: "#1E7C3F" },
  { id: "cultured", label: { sw: "Mtindi", en: "Cultured" }, color: "#2F9E44" },
  { id: "yoghurt", label: { sw: "Yogati", en: "Yoghurt" }, color: "#6FBF59" },
  { id: "cream", label: { sw: "Krimu", en: "Cream" }, color: "#8CC63F" },
  { id: "cheese", label: { sw: "Jibini", en: "Cheese" }, color: "#1D9E75" },
  { id: "ghee", label: { sw: "Samli", en: "Ghee" }, color: "#E5A100" },
  { id: "butter", label: { sw: "Siagi", en: "Butter" }, color: "#E11B22" },
];

interface CartLine {
  productId: string;
  qty: number;
  tier: PriceTier;
}

export function POSScreen() {
  const { t, lang, user } = useApp();
  const nav = useNavigate();
  const today = todayISO();
  const { data: allProducts = [], isPending } = useProducts();
  const { data: priceMatrix = {} } = usePriceMatrix();
  const { data: allCustomers = [] } = useCustomers();
  const customers = allCustomers.filter((c) => !c.suspended);
  const { data: stock = [] } = useStock();
  const { data: shift = [] } = useSalesByDate(today, "counter");
  const completeSaleMut = useCompleteSale();
  const voidSaleMut = useVoidSale();

  const [cat, setCat] = useState<ProductCategory>("fresh-milk");
  const [tier, setTier] = useState<PriceTier>("own");
  // Autosaved draft: a cart in progress survives an accidental refresh,
  // tab close or crash instead of vanishing. Cleared on a completed sale.
  const [cart, setCart] = useLocalStorage<CartLine[]>(`ajd:pos:cart:${user?.id ?? "anon"}`, []);
  const [parked, setParked] = useState<CartLine[][]>([]);
  const [customer, setCustomer] = useState("walkin");
  const [pay, setPay] = useState("cash");
  // Mpesa's single source of truth: a photo of the confirmation, not a
  // typed code, since there's nothing to check a typed code against.
  const [mpesaReceipt, setMpesaReceipt] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receipt, setReceipt] = useState<null | Sale>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const products = allProducts.filter((p) => p.category === cat && p.active);
  const priceOf = (pid: string, tr: PriceTier) => priceMatrix[pid]?.[tr] ?? 0;
  const finishedStock = (pid: string) =>
    stock.find((s) => s.productId === pid && s.category === "finished");
  const stockOf = (pid: string) => finishedStock(pid)?.onHand ?? 0;
  const isOut = (pid: string) => stockOf(pid) <= 0;
  const isLow = (pid: string) => {
    const s = finishedStock(pid);
    return s ? s.onHand > 0 && s.onHand < s.reorder : false;
  };

  const selectedCustomer = customer === "walkin" ? null : customers.find((c) => c.id === customer);
  const isCreditBlocked = pay === "credit" && selectedCustomer?.status === "overdue";

  const add = (pid: string) => {
    if (isOut(pid)) {
      toast.error(t("Bidhaa imeisha", "Out of stock"));
      return;
    }
    setCart((c) => {
      const ex = c.find((x) => x.productId === pid && x.tier === tier);
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: pid, qty: 1, tier }];
    });
  };
  const total = cart.reduce((a, l) => a + priceOf(l.productId, l.tier) * l.qty, 0);
  const itemCount = cart.reduce((a, l) => a + l.qty, 0);

  const completeSale = async () => {
    if (isCreditBlocked) {
      toast.error(t("Mteja amefungiwa mkopo (amechelewa)", "Customer is on credit hold (overdue)"));
      return;
    }
    if (pay === "mpesa" && !mpesaReceipt) {
      toast.error(t("Pakia picha ya risiti ya M-Pesa", "Upload a photo of the M-Pesa receipt"));
      return;
    }
    let receiptUrl: string | undefined;
    if (pay === "mpesa" && mpesaReceipt) {
      setUploadingReceipt(true);
      try {
        receiptUrl = await uploadHardCopy(mpesaReceipt, "sale");
      } catch {
        toast.error(t("Imeshindikana kupakia risiti", "Could not upload the receipt"));
        setUploadingReceipt(false);
        return;
      }
      setUploadingReceipt(false);
    }
    completeSaleMut.mutate(
      {
        channel: "counter",
        payment: pay === "stock" ? "stock-issue" : (pay as "cash" | "credit" | "mpesa"),
        tier,
        lines: cart.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: priceOf(l.productId, l.tier),
        })),
        customerId: customer === "walkin" ? undefined : customer,
        locationId: "loc-main",
        receiptUrl,
      },
      {
        onSuccess: (sale) => {
          setReceipt(sale);
          toast.success(t("Mauzo yamehifadhiwa", "Sale completed"));
          setCart([]);
          setMpesaReceipt(null);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("customer-overdue")
              ? t("Mteja ana deni lililochelewa", "Customer is overdue, credit blocked")
              : e.message.includes("day-locked")
                ? t("Siku hii imefungwa", "This day is locked")
                : t("Imeshindikana kukamilisha mauzo", "Could not complete the sale"),
          ),
      },
    );
  };

  const park = () => {
    if (!cart.length) return;
    setParked((p) => [cart, ...p]);
    setCart([]);
    toast.success(t("Mauzo yamewekwa pembeni", "Sale parked"));
  };

  const counterSales = shift.filter((s) => s.payment !== "stock-issue");
  const orders = shift.filter((s) => s.payment === "stock-issue");
  const todaySales = counterSales.reduce((a, s) => a + s.totalTZS, 0);
  const todayCash = counterSales
    .filter((s) => s.payment === "cash")
    .reduce((a, s) => a + s.totalTZS, 0);
  const todayMpesa = counterSales
    .filter((s) => s.payment === "mpesa")
    .reduce((a, s) => a + s.totalTZS, 0);
  const todayCredit = counterSales
    .filter((s) => s.payment === "credit")
    .reduce((a, s) => a + s.totalTZS, 0);

  if (isPending) {
    return (
      <AppShell title={t("Mauzo ya Kaunta", "Counter POS")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={3} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Mauzo ya Kaunta", "Counter POS")}>
      <DayLockBanner />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t("Mapato kipindi changu", "My shift revenue")}
          value={tzs(todaySales)}
          sub={`${counterSales.length} ${t("mauzo", "sales")}`}
          accent="green"
        />
        <StatCard label="Cash" value={tzs(todayCash)} accent="green" />
        <StatCard label="M-Pesa" value={tzs(todayMpesa)} accent="info" />
        <StatCard label={t("Mkopo", "Credit")} value={tzs(todayCredit)} accent="amber" />
      </div>
      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">{t("POS", "POS")}</TabsTrigger>
          <TabsTrigger value="orders">
            {t("Orders / utoaji wa stock", "Orders / stock issue")}
          </TabsTrigger>
          <TabsTrigger value="history">{t("Historia ya kipindi", "Shift history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {CATS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCat(c.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${cat === c.id ? "text-white shadow-card" : "bg-secondary text-foreground hover:bg-accent"}`}
                      style={cat === c.id ? { background: c.color } : undefined}
                    >
                      {lang === "sw" ? c.label.sw : c.label.en}
                    </button>
                  ))}
                </div>
                <Select value={tier} onValueChange={(v) => setTier(v as PriceTier)}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">{t("Chombo cha mteja", "Own container")}</SelectItem>
                    <SelectItem value="bottle">{t("Pamoja na chupa", "With bottle")}</SelectItem>
                    <SelectItem value="bulk">
                      {t("Bei ya jumla / dozeni", "Bulk / dozen")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map((p) => {
                  const out = isOut(p.id);
                  const low = isLow(p.id);
                  const onHand = stockOf(p.id);
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={out ? undefined : { scale: 0.97 }}
                      disabled={out}
                      onClick={() => add(p.id)}
                      className={`text-left rounded-xl border bg-background p-3 transition relative ${out ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-[#2F9E44] hover:shadow-card"}`}
                    >
                      <div
                        className="aspect-[16/9] rounded-lg mb-2 relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${CATS.find((c) => c.id === cat)?.color}30, ${CATS.find((c) => c.id === cat)?.color}10)`,
                        }}
                      >
                        <div className="absolute inset-0 grid place-items-center text-3xl">
                          {p.unit === "L" ? "🥛" : p.unit === "kg" ? "🧀" : "🥤"}
                        </div>
                      </div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.swName}</div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="font-num font-bold">{num(priceOf(p.id, tier))}</span>
                        <Pill tone={out ? "danger" : low ? "warning" : "success"}>
                          {out ? t("Imeisha", "Out") : low ? `${num(onHand)} ${p.unit}` : p.unit}
                        </Pill>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-card flex flex-col">
              <div className="px-4 py-3 border-b border-border font-display font-semibold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ShoppingBasket className="h-4 w-4" />
                  {t("Mkokoteni", "Cart")} ({itemCount})
                </span>
                {parked.length > 0 && (
                  <ParkedDropdown
                    parked={parked}
                    products={allProducts}
                    priceMatrix={priceMatrix}
                    onRestore={(idx) => {
                      setCart(parked[idx]);
                      setParked((p) => p.filter((_, i) => i !== idx));
                    }}
                  />
                )}
              </div>
              <div className="p-3 border-b border-border space-y-2">
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("Mteja", "Customer")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("Mteja wa kupita", "Walk-in")}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        {c.type !== "cash" && (
                          <span className="text-xs text-muted-foreground ml-2">({c.type})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && selectedCustomer.outstandingTZS > 0 && (
                  <div className="rounded-lg bg-secondary/60 px-2 py-1.5 text-[11px] flex justify-between">
                    <span className="text-muted-foreground">
                      {t("Deni la sasa", "Open balance")}
                    </span>
                    <span className="font-num font-semibold">
                      {tzs(selectedCustomer.outstandingTZS)}
                    </span>
                  </div>
                )}
                <Select value={pay} onValueChange={setPay}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                    <SelectItem value="credit">{t("Mkopo", "Credit")}</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="stock">{t("Utoaji wa stock", "Stock issue")}</SelectItem>
                  </SelectContent>
                </Select>
                {pay === "mpesa" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {t("Picha ya risiti ya M-Pesa", "Photo of the M-Pesa receipt")}
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setMpesaReceipt(e.target.files?.[0] ?? null)}
                      className="h-9 text-xs"
                    />
                    {mpesaReceipt && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {mpesaReceipt.name}
                      </div>
                    )}
                  </div>
                )}
                {isCreditBlocked && (
                  <div className="rounded-lg bg-[#E11B22]/10 text-[#E11B22] px-2 py-1.5 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    {t(
                      "Mteja amechelewa, anaweza tu kulipa cash au mpesa.",
                      "Customer is overdue, accept only cash or mpesa.",
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 max-h-[400px]">
                {cart.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    {t("Bonyeza bidhaa kuongeza", "Tap a product to add")}
                  </div>
                )}
                {cart.map((l, i) => {
                  const p = allProducts.find((x) => x.id === l.productId)!;
                  return (
                    <div key={i} className="rounded-xl bg-secondary/60 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {l.tier} · {num(priceOf(p.id, l.tier))}/{p.unit}
                          </div>
                        </div>
                        <button
                          onClick={() => setCart((c) => c.filter((_, k) => k !== i))}
                          className="text-muted-foreground hover:text-[#E11B22]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() =>
                            setCart((c) =>
                              c.map((x, k) =>
                                k === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x,
                              ),
                            )
                          }
                          className="rounded-md bg-background p-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-num w-8 text-center text-sm font-semibold">
                          {l.qty}
                        </span>
                        <button
                          onClick={() =>
                            setCart((c) =>
                              c.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)),
                            )
                          }
                          className="rounded-md bg-background p-1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="ml-auto font-num font-bold text-sm">
                          {tzs(priceOf(l.productId, l.tier) * l.qty)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t("Bidhaa", "Items")}</span>
                  <span className="font-num">{itemCount}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("Jumla", "Total")}</span>
                  <span className="font-num">{tzs(total)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!cart.length}
                    onClick={park}
                    title={t("Weka pembeni", "Park")}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button
                    disabled={
                      cart.length === 0 ||
                      isCreditBlocked ||
                      completeSaleMut.isPending ||
                      uploadingReceipt ||
                      (pay === "mpesa" && !mpesaReceipt)
                    }
                    onClick={completeSale}
                    className="flex-1 h-11 text-white"
                    style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                  >
                    {uploadingReceipt
                      ? t("Inapakia risiti…", "Uploading receipt…")
                      : completeSaleMut.isPending
                        ? t("Inakamilisha…", "Completing…")
                        : t("Kamilisha mauzo", "Complete sale")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <SectionCard
            title={t("Orders zilizotolewa kwa stock", "Direct orders fulfilled from stock")}
            action={
              <NewOrderDialog
                customers={customers}
                products={allProducts}
                priceMatrix={priceMatrix}
              />
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-2">#</th>
                  <th>{t("Mteja", "Customer")}</th>
                  <th>{t("Bidhaa", "Product")}</th>
                  <th className="text-right">{t("Idadi", "Qty")}</th>
                  <th className="text-right">{t("Jumla", "Total")}</th>
                  <th>{t("Hali", "Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {t("Hakuna orders leo bado", "No stock-issue orders today yet")}
                    </td>
                  </tr>
                ) : (
                  orders.map((r) => {
                    const line = r.lines?.[0];
                    const prod = allProducts.find((p) => p.id === line?.productId);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-2 font-num text-xs text-muted-foreground">
                          {r.id}
                        </td>
                        <td className="py-2.5 font-medium">
                          {r.customerName ?? t("Mteja wa kupita", "Walk-in")}
                        </td>
                        <td className="py-2.5">{prod?.name ?? line?.productId}</td>
                        <td className="py-2.5 text-right font-num">
                          {line ? `${num(line.qty)} ${line.unit}` : "·"}
                        </td>
                        <td className="py-2.5 text-right font-num font-semibold">
                          {tzs(r.totalTZS)}
                        </td>
                        <td className="py-2.5">
                          <Pill tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("Imetolewa", "Issued")}
                          </Pill>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => nav({ to: "/receipt/$id", params: { id: r.id } })}
                          >
                            <Printer className="h-3.5 w-3.5 mr-1" />
                            {t("Chapisha", "Print")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SectionCard
            title={t("Mauzo ya kipindi changu", "My shift sales")}
            action={
              <Pill tone="info">
                {user?.name.split(" ")[0]} · {today}
              </Pill>
            }
          >
            {counterSales.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t("Hakuna mauzo leo bado", "No sales today yet")}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Wakati", "Time")}</th>
                    <th>{t("Risiti", "Receipt")}</th>
                    <th>{t("Mteja", "Customer")}</th>
                    <th>{t("Malipo", "Payment")}</th>
                    <th className="text-right">{t("Jumla", "Total")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {counterSales.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                        {new Date(s.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 font-num text-xs">{s.id}</td>
                      <td className="py-2.5 font-medium">
                        {s.customerName ?? t("Mteja wa kupita", "Walk-in")}
                      </td>
                      <td className="py-2.5">
                        <Pill
                          tone={
                            s.payment === "cash"
                              ? "success"
                              : s.payment === "credit"
                                ? "warning"
                                : "info"
                          }
                        >
                          {s.payment}
                        </Pill>
                      </td>
                      <td className="py-2.5 text-right font-num font-semibold">
                        {tzs(s.totalTZS)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => nav({ to: "/receipt/$id", params: { id: s.id } })}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          {t("Chapisha", "Print")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-[#E11B22]"
                          onClick={() => {
                            setVoiding(s);
                            setVoidReason("");
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          {t("Batilisha", "Void")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Batilisha risiti?", "Void this receipt?")}</DialogTitle>
          </DialogHeader>
          {voiding && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t(
                  `Risiti ${voiding.id} (${tzs(voiding.totalTZS)}) itabatilishwa, stock itarudi na deni la mteja (kama lipo) litapunguzwa. Haiwezi kutenduliwa.`,
                  `Receipt ${voiding.id} (${tzs(voiding.totalTZS)}) will be voided, stock is put back and any credit balance it created is reversed. This cannot be undone.`,
                )}
              </p>
              <div>
                <Label>{t("Sababu (hiari)", "Reason (optional)")}</Label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t("mf. Bidhaa mbaya iliingizwa", "e.g. wrong item rung up")}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>
              {t("Ghairi", "Cancel")}
            </Button>
            <Button
              className="bg-[#E11B22] text-white hover:bg-[#c41319]"
              disabled={voidSaleMut.isPending}
              onClick={() => {
                if (!voiding) return;
                voidSaleMut.mutate(
                  { saleId: voiding.id, reason: voidReason || undefined },
                  {
                    onSuccess: () => {
                      toast.success(t("Risiti imebatilishwa", "Receipt voided"));
                      setVoiding(null);
                    },
                    onError: (e) =>
                      toast.error(
                        e.message.includes("day-locked")
                          ? t("Siku hii imefungwa", "This day is locked")
                          : e.message.includes("already-voided")
                            ? t("Tayari imebatilishwa", "Already voided")
                            : t("Imeshindikana kubatilisha", "Could not void the receipt"),
                      ),
                  },
                );
              }}
            >
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              {t("Batilisha", "Void")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Risiti", "Receipt")}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="rounded-xl border border-dashed border-border p-4 font-mono text-sm">
              <div className="text-center font-display font-bold">African Joy Dairy</div>
              <div className="text-center text-xs text-muted-foreground">
                Arusha · {new Date(receipt.at).toLocaleString()}
              </div>
              <div className="text-center text-xs mt-1">
                {t("Risiti", "Receipt")}: <span className="font-semibold">{receipt.id}</span>
              </div>
              <hr className="my-3" />
              {(receipt.lines ?? []).map((l, i) => {
                const p = allProducts.find((x) => x.id === l.productId);
                return (
                  <div key={i} className="flex justify-between">
                    <span>
                      {p?.name ?? l.productId} × {num(l.qty)}
                    </span>
                    <span>{num(l.amountTZS)}</span>
                  </div>
                );
              })}
              <hr className="my-3" />
              <div className="flex justify-between font-bold text-base">
                <span>{t("Jumla", "Total")}</span>
                <span>{tzs(receipt.totalTZS)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("Mteja", "Customer")}: {receipt.customerName ?? t("Mteja wa kupita", "Walk-in")}{" "}
                · {receipt.payment}
              </div>
              <div className="text-center text-[10px] text-muted-foreground mt-3">
                {t("Asante kwa kuchagua African Joy", "Thank you for choosing African Joy")}
              </div>
            </div>
          )}
          <Button
            onClick={() => {
              if (receipt) {
                const id = receipt.id;
                setReceipt(null);
                nav({ to: "/receipt/$id", params: { id } });
              }
            }}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            {t("Fungua kwa kuchapisha", "Open print view")}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ParkedDropdown({
  parked,
  products,
  priceMatrix,
  onRestore,
}: {
  parked: CartLine[][];
  products: Product[];
  priceMatrix: PriceMatrix;
  onRestore: (i: number) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <History className="h-3.5 w-3.5 mr-1" /> {parked.length}{" "}
          {t("zimewekwa pembeni", "parked")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Mauzo yaliyowekwa pembeni", "Parked sales")}</DialogTitle>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {parked.map((p, i) => {
            const total = p.reduce(
              (a, l) => a + (priceMatrix[l.productId]?.[l.tier] ?? 0) * l.qty,
              0,
            );
            return (
              <li key={i} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm">
                    {p.length} {t("vifurushi", "items")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.map((l) => products.find((x) => x.id === l.productId)?.name).join(", ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num font-bold">{tzs(total)}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      onRestore(i);
                      setOpen(false);
                    }}
                  >
                    {t("Endelea", "Restore")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function NewOrderDialog({
  customers,
  products,
  priceMatrix,
}: {
  customers: Customer[];
  products: Product[];
  priceMatrix: PriceMatrix;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const complete = useCompleteSale();

  const save = () => {
    const cid = customerId || customers[0]?.id;
    const pid = productId || products[0]?.id;
    if (!cid || !pid || qty <= 0) return;
    complete.mutate(
      {
        channel: "counter",
        payment: "stock-issue",
        tier: "bulk",
        lines: [{ productId: pid, qty, unitPrice: priceMatrix[pid]?.bulk ?? 0 }],
        customerId: cid,
        locationId: "loc-main",
      },
      {
        onSuccess: () => {
          toast.success(t("Order imeundwa", "Order created"));
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kuunda order", "Could not create order")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Order mpya", "New order")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-4 w-4" />
            {t("Unda order ya kutoa kwa stock", "Create stock-issue order")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Mteja", "Customer")}</Label>
            <Select value={customerId || customers[0]?.id} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Bidhaa", "Product")}</Label>
              <Select value={productId || products[0]?.id} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Idadi", "Qty")}</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={complete.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {complete.isPending ? t("Inaunda…", "Creating…") : t("Unda", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
