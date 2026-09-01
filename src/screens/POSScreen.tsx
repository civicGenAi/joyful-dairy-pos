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
import { useRef, useState } from "react";
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
  Search,
  Delete,
  LayoutGrid,
  ListPlus,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import type { Customer, PriceMatrix, Product } from "@/mock/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { DayLockBanner } from "@/components/shell/DayLockBanner";
import { uploadHardCopy } from "@/lib/data/uploads";
import { useIssueOrderInvoice } from "@/lib/data/hooks/invoices";
import { FileText } from "lucide-react";

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

const TIER_LABEL: Record<PriceTier, { sw: string; en: string }> = {
  own: { sw: "Chombo cha mteja", en: "Own container" },
  bottle: { sw: "Chupa", en: "With bottle" },
  bulk: { sw: "Jumla", en: "Bulk" },
};

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
  const issueInvoiceMut = useIssueOrderInvoice();

  const [cat, setCat] = useState<ProductCategory>("fresh-milk");
  const [tier, setTier] = useState<PriceTier>("own");
  // "Browse" is the grid of tappable tiles, "List" is a faster pick-product,
  // type-quantity, add-line flow for ringing up many different products at
  // once (e.g. summarizing a day's shop sales in one go) instead of tapping
  // through category tiles one product at a time.
  const [mode, setMode] = useState<"browse" | "list">("browse");
  const [listProductId, setListProductId] = useState("");
  const [listQty, setListQty] = useState<number | "">("");
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
  // Search finds a product across every category, once at least two
  // letters are typed, so a cashier never has to hunt through the tabs.
  const [productQuery, setProductQuery] = useState("");
  // Long-pressing a tile opens a keypad to set an exact quantity (bulk
  // sales like 20L), a plain tap keeps adding one unit at a time. Carries
  // its own tier so editing an existing cart line always targets that
  // line, not whatever the tier selector currently shows.
  const [qtyPrompt, setQtyPrompt] = useState<{ product: Product; tier: PriceTier } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const startPress = (p: Product) => {
    if (isOut(p.id)) return;
    longPressFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setQtyPrompt({ product: p, tier });
    }, 450);
  };
  const endPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const productQueryNorm = productQuery.trim().toLowerCase();
  const products =
    productQueryNorm.length >= 2
      ? allProducts.filter((p) => p.active && p.name.toLowerCase().includes(productQueryNorm))
      : allProducts.filter((p) => p.category === cat && p.active);
  const priceOf = (pid: string, tr: PriceTier) => priceMatrix[pid]?.[tr] ?? 0;
  const finishedStock = (pid: string) =>
    stock.find((s) => s.productId === pid && s.category === "finished");
  const stockOf = (pid: string) => finishedStock(pid)?.onHand ?? 0;
  const isOut = (pid: string) => stockOf(pid) <= 0;
  const isLow = (pid: string) => {
    const s = finishedStock(pid);
    return s ? s.onHand > 0 && s.onHand < s.reorder : false;
  };
  const cartQtyOf = (pid: string, forTier: PriceTier = tier) =>
    cart.filter((l) => l.productId === pid && l.tier === forTier).reduce((a, l) => a + l.qty, 0);

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
  // List mode: adds a specific quantity in one go (merging into an existing
  // line for the same product+tier) instead of always incrementing by 1.
  const addQty = (pid: string, qty: number) => {
    if (qty <= 0) return;
    if (isOut(pid)) {
      toast.error(t("Bidhaa imeisha", "Out of stock"));
      return;
    }
    setCart((c) => {
      const ex = c.find((x) => x.productId === pid && x.tier === tier);
      if (ex) return c.map((x) => (x === ex ? { ...x, qty: x.qty + qty } : x));
      return [...c, { productId: pid, qty, tier }];
    });
  };
  // From the quantity keypad: sets the line to an exact amount rather than
  // adding on top, so retyping a number always means "this is the total".
  // Targets a specific tier (the line being edited), not necessarily
  // whatever the tier selector currently shows.
  const setExactQty = (pid: string, qty: number, forTier: PriceTier) => {
    if (qty <= 0) {
      setCart((c) => c.filter((x) => !(x.productId === pid && x.tier === forTier)));
      return;
    }
    setCart((c) => {
      const ex = c.find((x) => x.productId === pid && x.tier === forTier);
      if (ex) return c.map((x) => (x === ex ? { ...x, qty } : x));
      return [...c, { productId: pid, qty, tier: forTier }];
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
              {/* Step 1: price tier. Its own full-width row, impossible to
                  miss or leave on the wrong setting by accident. */}
              <div className="px-4 pt-3 pb-2 border-b border-border">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("Bei ya kuuza", "Selling at")}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "own", sw: "Chombo cha mteja", en: "Own container" },
                      { id: "bottle", sw: "Pamoja na chupa", en: "With bottle" },
                      { id: "bulk", sw: "Jumla / dazani", en: "Bulk / dozen" },
                    ] as const
                  ).map((tr) => (
                    <button
                      key={tr.id}
                      onClick={() => setTier(tr.id)}
                      className={`rounded-lg py-2 text-xs font-bold transition-all ${
                        tier === tr.id
                          ? "bg-[#1E7C3F] text-white shadow-card"
                          : "bg-secondary text-foreground hover:bg-accent"
                      }`}
                    >
                      {t(tr.sw, tr.en)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browse vs List mode toggle. */}
              <div className="px-4 py-2 border-b border-border flex items-center gap-1.5">
                <button
                  onClick={() => setMode("browse")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "browse"
                      ? "bg-[#1E7C3F] text-white shadow-card"
                      : "bg-secondary text-foreground hover:bg-accent"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t("Vinjari", "Browse")}
                </button>
                <button
                  onClick={() => setMode("list")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "list"
                      ? "bg-[#1E7C3F] text-white shadow-card"
                      : "bg-secondary text-foreground hover:bg-accent"
                  }`}
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  {t("Orodha, ongeza haraka", "List, add fast")}
                </button>
              </div>

              {mode === "browse" ? (
                <>
                  {/* Step 2: find the product, by category or by typing. */}
                  <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        placeholder={t("Tafuta bidhaa, herufi 2+…", "Search products, 2+ letters…")}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    {productQueryNorm.length < 2 && (
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
                    )}
                  </div>
                  <div className="px-4 pt-2 text-[11px] text-muted-foreground">
                    {t(
                      "Bonyeza kuongeza 1, shikilia kuweka idadi kamili (mf. lita 20)",
                      "Tap to add 1, press and hold to enter an exact quantity (e.g. 20L)",
                    )}
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {products.length === 0 && (
                      <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                        {productQueryNorm.length >= 2
                          ? t("Hakuna bidhaa inayolingana", "No matching product")
                          : t("Hakuna bidhaa katika kundi hili", "No products in this category")}
                      </div>
                    )}
                    {products.map((p) => {
                      const out = isOut(p.id);
                      const low = isLow(p.id);
                      const onHand = stockOf(p.id);
                      const inCart = cartQtyOf(p.id);
                      const catColor = CATS.find((c) => c.id === p.category)?.color ?? "#1E7C3F";
                      return (
                        <motion.button
                          key={p.id}
                          whileTap={out ? undefined : { scale: 0.97 }}
                          disabled={out}
                          onClick={() => {
                            if (longPressFired.current) {
                              longPressFired.current = false;
                              return;
                            }
                            add(p.id);
                          }}
                          onPointerDown={() => startPress(p)}
                          onPointerUp={endPress}
                          onPointerLeave={endPress}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`text-left rounded-xl border bg-background p-3 transition relative ${out ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-[#2F9E44] hover:shadow-card"}`}
                        >
                          {inCart > 0 && (
                            <span className="absolute -top-2 -right-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-[#1E7C3F] px-1 text-xs font-bold text-white shadow-card">
                              {num(inCart)}
                            </span>
                          )}
                          <div
                            className="aspect-[16/9] rounded-lg mb-2 relative overflow-hidden"
                            style={{
                              background: `linear-gradient(135deg, ${catColor}30, ${catColor}10)`,
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
                              {out
                                ? t("Imeisha", "Out")
                                : low
                                  ? `${num(onHand)} ${p.unit}`
                                  : p.unit}
                            </Pill>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <ListEntryPanel
                  products={allProducts.filter((p) => p.active)}
                  tier={tier}
                  priceOf={priceOf}
                  isOut={isOut}
                  productId={listProductId}
                  setProductId={setListProductId}
                  qty={listQty}
                  setQty={setListQty}
                  onAdd={() => {
                    if (!listProductId || !listQty || Number(listQty) <= 0) return;
                    addQty(listProductId, Number(listQty));
                    setListQty("");
                  }}
                />
              )}
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("Mteja na malipo", "Customer & payment")}
                </div>
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
                            {TIER_LABEL[l.tier][lang]} · {num(priceOf(p.id, l.tier))}/{p.unit}
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
                          className="grid h-7 w-7 place-items-center rounded-md bg-background hover:bg-accent active:scale-95 transition-all"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const prod = allProducts.find((x) => x.id === l.productId);
                            if (prod) setQtyPrompt({ product: prod, tier: l.tier });
                          }}
                          className="font-num w-12 text-center text-sm font-bold hover:underline"
                          title={t("Bonyeza kubadilisha idadi", "Tap to change quantity")}
                        >
                          {num(l.qty)}
                        </button>
                        <button
                          onClick={() =>
                            setCart((c) =>
                              c.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)),
                            )
                          }
                          className="grid h-7 w-7 place-items-center rounded-md bg-background hover:bg-accent active:scale-95 transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
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
                <div className="flex justify-between text-xl font-extrabold">
                  <span>{t("Jumla", "Total")}</span>
                  <span className="font-num">{tzs(total)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!cart.length}
                    onClick={park}
                    title={t("Weka pembeni", "Park")}
                    className="h-12 w-12"
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
                    className="flex-1 h-12 text-base font-extrabold text-white shadow-card transition-transform active:scale-[0.98]"
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
                    const orderLines = r.lines ?? [];
                    const names = orderLines
                      .map(
                        (l) => allProducts.find((p) => p.id === l.productId)?.name ?? l.productId,
                      )
                      .join(", ");
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-2 font-num text-xs text-muted-foreground">
                          {r.id}
                        </td>
                        <td className="py-2.5 font-medium">
                          {r.customerName ?? t("Mteja wa kupita", "Walk-in")}
                        </td>
                        <td className="py-2.5 max-w-[220px] truncate" title={names}>
                          {names || "·"}
                        </td>
                        <td className="py-2.5 text-right font-num">
                          {orderLines.length === 1
                            ? `${num(orderLines[0].qty)} ${orderLines[0].unit}`
                            : `${orderLines.length} ${t("bidhaa", "items")}`}
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
                        {s.customerId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={issueInvoiceMut.isPending}
                            title={t(
                              "Tengeneza ankara rasmi kwa mteja huyu",
                              "Generate a formal invoice for this customer",
                            )}
                            onClick={() =>
                              issueInvoiceMut.mutate(
                                { saleId: s.id },
                                {
                                  onSuccess: (inv) =>
                                    nav({ to: "/invoice/$id", params: { id: inv.id } }),
                                  onError: () =>
                                    toast.error(
                                      t(
                                        "Imeshindikana kutengeneza ankara",
                                        "Could not generate the invoice",
                                      ),
                                    ),
                                },
                              )
                            }
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {t("Ankara", "Invoice")}
                          </Button>
                        )}
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

      <QuantityKeypadDialog
        product={qtyPrompt?.product ?? null}
        unit={qtyPrompt?.product.unit}
        initialQty={qtyPrompt ? cartQtyOf(qtyPrompt.product.id, qtyPrompt.tier) : 0}
        priceEach={qtyPrompt ? priceOf(qtyPrompt.product.id, qtyPrompt.tier) : 0}
        onClose={() => setQtyPrompt(null)}
        onConfirm={(qty) => {
          if (qtyPrompt) setExactQty(qtyPrompt.product.id, qty, qtyPrompt.tier);
          setQtyPrompt(null);
        }}
      />
    </AppShell>
  );
}

/** List mode: pick a product, its price at the current tier previews, type
 *  a quantity, Add joins/merges it into the cart. Faster than tapping
 *  through category tiles when ringing up several different products. */
function ListEntryPanel({
  products,
  tier,
  priceOf,
  isOut,
  productId,
  setProductId,
  qty,
  setQty,
  onAdd,
}: {
  products: Product[];
  tier: PriceTier;
  priceOf: (pid: string, tier: PriceTier) => number;
  isOut: (pid: string) => boolean;
  productId: string;
  setProductId: (id: string) => void;
  qty: number | "";
  setQty: (q: number | "") => void;
  onAdd: () => void;
}) {
  const { t } = useApp();
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const selected = products.find((p) => p.id === productId);
  const price = productId ? priceOf(productId, tier) : 0;
  const out = productId ? isOut(productId) : false;

  return (
    <div className="p-4 space-y-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">{t("Bidhaa", "Product")}</Label>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger>
            <SelectValue placeholder={t("Chagua bidhaa…", "Select a product…")} />
          </SelectTrigger>
          <SelectContent>
            {sorted.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <div className="grid gap-1.5 flex-1">
          <Label className="text-xs">
            {t("Idadi", "Qty")}
            {selected ? ` (${selected.unit})` : ""}
          </Label>
          <Input
            type="number"
            step="any"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            className="font-num"
          />
        </div>
        <Button disabled={!productId || !qty || Number(qty) <= 0 || out} onClick={onAdd}>
          {t("Ongeza", "Add")}
        </Button>
      </div>
      {productId && (
        <div className="text-xs text-muted-foreground">
          {out ? (
            <span className="text-[#E11B22] font-semibold">
              {t("Bidhaa imeisha", "Out of stock")}
            </span>
          ) : (
            <>
              {t("Bei", "Price")}: <span className="font-num font-semibold">{num(price)}</span>/
              {selected?.unit}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuantityKeypadDialog({
  product,
  unit,
  initialQty,
  priceEach,
  onClose,
  onConfirm,
}: {
  product: Product | null;
  unit?: string;
  initialQty: number;
  priceEach: number;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}) {
  const { t } = useApp();
  const [value, setValue] = useState("");

  // Re-seed the display each time a new product is opened, blank if it
  // wasn't in the cart yet, otherwise its current quantity so retyping
  // just corrects the total.
  const key = product?.id ?? "";
  const [seededFor, setSeededFor] = useState("");
  if (product && seededFor !== key) {
    setSeededFor(key);
    setValue(initialQty > 0 ? String(initialQty) : "");
  }

  const press = (d: string) => {
    if (d === "." && value.includes(".")) return;
    if (value.length >= 7) return;
    setValue((v) => (v === "0" && d !== "." ? d : v + d));
  };
  const backspace = () => setValue((v) => v.slice(0, -1));
  const qty = Number(value) || 0;
  const lineTotal = qty * priceEach;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">{product?.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl bg-secondary/60 p-4 text-center">
          <div className="font-num text-4xl font-extrabold tabular-nums">
            {value || "0"}
            <span className="ml-1.5 text-lg font-semibold text-muted-foreground">{unit}</span>
          </div>
          {qty > 0 && (
            <div className="mt-1 font-num text-sm font-semibold text-[#1E7C3F]">
              {tzs(lineTotal)}
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          {[1, 5, 10, 20, 50].map((n) => (
            <button
              key={n}
              onClick={() => setValue(String(n))}
              className="flex-1 rounded-lg bg-secondary py-1.5 text-xs font-bold hover:bg-accent"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="rounded-lg bg-background border border-border py-3 text-lg font-bold hover:bg-accent active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <button
            onClick={backspace}
            className="grid place-items-center rounded-lg bg-background border border-border py-3 hover:bg-accent active:scale-95 transition-all"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            disabled={qty <= 0}
            onClick={() => onConfirm(qty)}
            className="text-white font-bold"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {initialQty > 0 ? t("Sasisha", "Update") : t("Ongeza", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

interface OrderLine {
  productId: string;
  qty: number;
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
  const [payment, setPayment] = useState<"stock-issue" | "mpesa">("stock-issue");
  const [mpesaReceipt, setMpesaReceipt] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const complete = useCompleteSale();

  const priceOf = (pid: string) => priceMatrix[pid]?.bulk ?? 0;
  const total = lines.reduce((a, l) => a + priceOf(l.productId) * l.qty, 0);

  const addLine = () => {
    if (!productId || !qty || Number(qty) <= 0) return;
    const q = Number(qty);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === productId);
      if (i >= 0) {
        const next = [...ls];
        next[i] = { ...next[i], qty: next[i].qty + q };
        return next;
      }
      return [...ls, { productId, qty: q }];
    });
    setQty("");
  };
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const reset = () => {
    setLines([]);
    setProductId("");
    setQty("");
    setMpesaReceipt(null);
  };

  const save = async () => {
    const cid = customerId || customers[0]?.id;
    if (!cid || lines.length === 0) return;
    if (payment === "mpesa" && !mpesaReceipt) {
      toast.error(t("Pakia picha ya risiti ya M-Pesa", "Upload a photo of the M-Pesa receipt"));
      return;
    }
    let receiptUrl: string | undefined;
    if (payment === "mpesa" && mpesaReceipt) {
      setUploading(true);
      try {
        receiptUrl = await uploadHardCopy(mpesaReceipt, "sale");
      } catch {
        toast.error(t("Imeshindikana kupakia risiti", "Could not upload the receipt"));
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    complete.mutate(
      {
        channel: "counter",
        payment,
        tier: "bulk",
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: priceOf(l.productId),
        })),
        customerId: cid,
        locationId: "loc-main",
        receiptUrl,
      },
      {
        onSuccess: () => {
          toast.success(t("Order imeundwa", "Order created"));
          setOpen(false);
          reset();
        },
        onError: () => toast.error(t("Imeshindikana kuunda order", "Could not create order")),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Order mpya", "New order")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-4 w-4" />
            {t("Unda order", "Create order")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid gap-1.5">
              <Label>{t("Malipo", "Payment")}</Label>
              <Select
                value={payment}
                onValueChange={(v) => setPayment(v as "stock-issue" | "mpesa")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock-issue">{t("Utoaji wa stock", "Stock issue")}</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {payment === "mpesa" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
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

          <div className="rounded-lg border border-border p-3 space-y-2">
            <Label>{t("Ongeza bidhaa", "Add a product")}</Label>
            <div className="flex items-end gap-2">
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("Chagua bidhaa…", "Select a product…")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="any"
                min={0}
                placeholder={t("Idadi", "Qty")}
                value={qty}
                onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-24 font-num"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!productId || !qty || Number(qty) <= 0}
                onClick={addLine}
              >
                {t("Ongeza", "Add")}
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              {t("Bado hakuna bidhaa", "No products added yet")}
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-2">{t("Bidhaa", "Product")}</th>
                    <th className="text-right px-2">{t("Idadi", "Qty")}</th>
                    <th className="text-right px-2">{t("Jumla", "Amount")}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.productId} className="border-b border-border last:border-0">
                      <td className="py-1.5 px-2">
                        {products.find((p) => p.id === l.productId)?.name}
                      </td>
                      <td className="py-1.5 px-2 text-right font-num">{l.qty}</td>
                      <td className="py-1.5 px-2 text-right font-num font-semibold">
                        {num(l.qty * priceOf(l.productId))}
                      </td>
                      <td className="py-1.5 px-1 text-right">
                        <button
                          onClick={() => removeLine(i)}
                          className="text-muted-foreground hover:text-[#E11B22]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm font-semibold">
            <span>{t("Jumla", "Total")}</span>
            <span className="font-num">{tzs(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={complete.isPending || uploading || lines.length === 0}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {uploading
              ? t("Inapakia risiti…", "Uploading receipt…")
              : complete.isPending
                ? t("Inaunda…", "Creating…")
                : t("Unda", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
