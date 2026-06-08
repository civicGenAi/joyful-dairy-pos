import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { PRODUCTS, PRICE_MATRIX, CUSTOMERS, STOCK, TODAY } from "@/mock/data";
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
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";

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
interface CompletedSale {
  id: string;
  total: number;
  lines: CartLine[];
  customer: string;
  payment: string;
  at: string;
}

// Demo "my shift" history.
const SHIFT_SEED: CompletedSale[] = [
  {
    id: "RCT-2105",
    total: 18000,
    lines: [{ productId: "p-fresh", qty: 12, tier: "own" }],
    customer: "walkin",
    payment: "cash",
    at: "08:42",
  },
  {
    id: "RCT-2106",
    total: 12000,
    lines: [{ productId: "p-mtindi", qty: 6, tier: "own" }],
    customer: "walkin",
    payment: "mpesa",
    at: "09:15",
  },
  {
    id: "RCT-2107",
    total: 42000,
    lines: [{ productId: "p-mozz", qty: 3, tier: "bulk" }],
    customer: "c1",
    payment: "credit",
    at: "10:30",
  },
];

const ORDERS_SEED = [
  {
    id: 1001,
    customerId: "c1",
    customer: "Mamis Bistro",
    productId: "p-mozz",
    product: "Mozzarella",
    qty: "3 kg",
    amount: 42000,
    status: "issued" as const,
  },
  {
    id: 1002,
    customerId: "c15",
    customer: "CSR Hotel",
    productId: "p-fresh",
    product: "Fresh milk",
    qty: "40 L",
    amount: 60000,
    status: "issued" as const,
  },
  {
    id: 1003,
    customerId: "c13",
    customer: "Jovinary Hotel",
    productId: "p-mtindi",
    product: "Mtindi",
    qty: "30 L",
    amount: 51000,
    status: "pending" as const,
  },
  {
    id: 1004,
    customerId: "c6",
    customer: "Sidhu Restaurant",
    productId: "p-yog-van",
    product: "Yoghurt Vanilla",
    qty: "24 pcs",
    amount: 60000,
    status: "issued" as const,
  },
];

export function POSScreen() {
  const { t, lang, user } = useApp();
  const nav = useNavigate();
  const [cat, setCat] = useState<ProductCategory>("fresh-milk");
  const [tier, setTier] = useState<PriceTier>("own");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [parked, setParked] = useState<CartLine[][]>([]);
  const [customer, setCustomer] = useState("walkin");
  const [pay, setPay] = useState("cash");
  const [receipt, setReceipt] = useState<null | CompletedSale>(null);
  const [shift, setShift] = useState<CompletedSale[]>(SHIFT_SEED);
  const [orders, setOrders] = useState(ORDERS_SEED);

  const products = PRODUCTS.filter((p) => p.category === cat && p.active);
  const stockOf = (pid: string) => STOCK.find((s) => s.productId === pid)?.onHand ?? 0;
  const isOut = (pid: string) => stockOf(pid) <= 0;
  const isLow = (pid: string) => {
    const s = STOCK.find((x) => x.productId === pid);
    return s ? s.onHand > 0 && s.onHand < s.reorder : false;
  };

  const selectedCustomer = customer === "walkin" ? null : CUSTOMERS.find((c) => c.id === customer);
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
  const total = cart.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);
  const itemCount = cart.reduce((a, l) => a + l.qty, 0);

  const completeSale = () => {
    if (isCreditBlocked) {
      toast.error(t("Mteja amefungiwa mkopo (amechelewa)", "Customer is on credit hold (overdue)"));
      return;
    }
    const sale: CompletedSale = {
      id: `RCT-${Math.floor(Math.random() * 9000 + 1000)}`,
      total,
      lines: cart,
      customer:
        customer === "walkin"
          ? lang === "sw"
            ? "Mteja wa kupita"
            : "Walk-in"
          : (CUSTOMERS.find((c) => c.id === customer)?.name ?? customer),
      payment: pay,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setReceipt(sale);
    setShift((xs) => [sale, ...xs]);
    toast.success(t("Mauzo yamehifadhiwa", "Sale completed"));
    setCart([]);
  };

  const park = () => {
    if (!cart.length) return;
    setParked((p) => [cart, ...p]);
    setCart([]);
    toast.success(t("Mauzo yamewekwa pembeni", "Sale parked"));
  };

  const todaySales = shift.reduce((a, s) => a + s.total, 0);
  const todayCash = shift.filter((s) => s.payment === "cash").reduce((a, s) => a + s.total, 0);
  const todayMpesa = shift.filter((s) => s.payment === "mpesa").reduce((a, s) => a + s.total, 0);
  const todayCredit = shift.filter((s) => s.payment === "credit").reduce((a, s) => a + s.total, 0);

  return (
    <AppShell title={t("Mauzo ya Kaunta", "Counter POS")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t("Mapato kipindi changu", "My shift revenue")}
          value={tzs(todaySales)}
          sub={`${shift.length} ${t("mauzo", "sales")}`}
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
                        <span className="font-num font-bold">{num(PRICE_MATRIX[p.id][tier])}</span>
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
                    {CUSTOMERS.map((c) => (
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
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  return (
                    <div key={i} className="rounded-xl bg-secondary/60 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {l.tier} · {num(PRICE_MATRIX[p.id][l.tier])}/{p.unit}
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
                          {tzs(PRICE_MATRIX[l.productId][l.tier] * l.qty)}
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
                    disabled={cart.length === 0 || isCreditBlocked}
                    onClick={completeSale}
                    className="flex-1 h-11 text-white"
                    style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                  >
                    {t("Kamilisha mauzo", "Complete sale")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <SectionCard
            title={t("Orders zilizotolewa kwa stock", "Direct orders fulfilled from stock")}
            action={<NewOrderDialog onAdd={(o) => setOrders((xs) => [o, ...xs])} />}
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
                {orders.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-2 font-num text-xs text-muted-foreground">{r.id}</td>
                    <td className="py-2.5 font-medium">{r.customer}</td>
                    <td className="py-2.5">{r.product}</td>
                    <td className="py-2.5 text-right font-num">{r.qty}</td>
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(r.amount)}</td>
                    <td className="py-2.5">
                      <Pill tone={r.status === "issued" ? "success" : "warning"}>{r.status}</Pill>
                    </td>
                    <td className="py-2.5 text-right">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setOrders((xs) =>
                              xs.map((x) => (x.id === r.id ? { ...x, status: "issued" } : x)),
                            );
                            toast.success(t("Order imetolewa", "Order issued"));
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("Toa", "Mark issued")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SectionCard
            title={t("Mauzo ya kipindi changu", "My shift sales")}
            action={
              <Pill tone="info">
                {user?.name.split(" ")[0]} · {TODAY}
              </Pill>
            }
          >
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
                {shift.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{s.at}</td>
                    <td className="py-2.5 font-num text-xs">{s.id}</td>
                    <td className="py-2.5 font-medium">{s.customer}</td>
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
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(s.total)}</td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Risiti", "Receipt")}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="rounded-xl border border-dashed border-border p-4 font-mono text-sm">
              <div className="text-center font-display font-bold">African Joy Dairy</div>
              <div className="text-center text-xs text-muted-foreground">
                Arusha · {new Date().toLocaleString()}
              </div>
              <div className="text-center text-xs mt-1">
                {t("Risiti", "Receipt")}: <span className="font-semibold">{receipt.id}</span>
              </div>
              <hr className="my-3" />
              {receipt.lines.map((l, i) => {
                const p = PRODUCTS.find((x) => x.id === l.productId)!;
                return (
                  <div key={i} className="flex justify-between">
                    <span>
                      {p.name} × {l.qty}
                    </span>
                    <span>{num(PRICE_MATRIX[l.productId][l.tier] * l.qty)}</span>
                  </div>
                );
              })}
              <hr className="my-3" />
              <div className="flex justify-between font-bold text-base">
                <span>{t("Jumla", "Total")}</span>
                <span>{tzs(receipt.total)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("Mteja", "Customer")}: {receipt.customer} · {receipt.payment}
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
  onRestore,
}: {
  parked: CartLine[][];
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
            const total = p.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);
            return (
              <li key={i} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm">
                    {p.length} {t("vifurushi", "items")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.map((l) => PRODUCTS.find((x) => x.id === l.productId)?.name).join(", ")}
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

function NewOrderDialog({ onAdd }: { onAdd: (o: (typeof ORDERS_SEED)[number]) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(CUSTOMERS[0].id);
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [qty, setQty] = useState(1);

  const save = () => {
    const cust = CUSTOMERS.find((c) => c.id === customerId)!;
    const prod = PRODUCTS.find((p) => p.id === productId)!;
    const price = PRICE_MATRIX[productId].bulk * qty;
    onAdd({
      id: Math.floor(Math.random() * 9000 + 1000),
      customerId,
      customer: cust.name,
      productId,
      product: prod.name,
      qty: `${qty} ${prod.unit}`,
      amount: price,
      status: "pending",
    });
    toast.success(t("Order imeundwa", "Order created"));
    setOpen(false);
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
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMERS.map((c) => (
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
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
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
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {t("Unda", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
