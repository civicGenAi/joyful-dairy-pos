import { useApp } from "@/app/context";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
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
import { CUSTOMERS, PRODUCTS, PRICE_MATRIX, ROUTE_LOAD, TODAY } from "@/mock/data";
import { tzs, L, num } from "@/lib/format";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Truck,
  Plus,
  Minus,
  Receipt,
  RotateCcw,
  LogOut,
  Search,
  ArrowRight,
  MapPin,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tier = "own" | "bottle" | "bulk";
interface CartLine {
  productId: string;
  qty: number;
  tier: Tier;
}
interface RouteSale {
  id: string;
  at: string;
  customerId: string;
  customer: string;
  lines: CartLine[];
  total: number;
  payment: "cash" | "credit" | "mpesa";
}

export function RouteScreen() {
  const { user, t, logout } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("plan");
  const [online, setOnline] = useState(true);
  const [session, setSession] = useState<"morning" | "evening">("morning");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState(CUSTOMERS[0].id);
  const [customerQ, setCustomerQ] = useState("");
  const [payment, setPayment] = useState<"cash" | "credit" | "mpesa">("cash");
  const [sales, setSales] = useState<RouteSale[]>([]);
  const [routeStops] = useState(["c1", "c5", "c9", "c11", "c15"]); // demo route plan
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [deposit, setDeposit] = useState(0);

  const cartTotal = cart.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);
  const loadedValue = ROUTE_LOAD.reduce((a, l) => a + PRICE_MATRIX[l.productId].own * l.litres, 0);

  // Derived cash-up from actual sales.
  const cashTotal = sales.filter((s) => s.payment === "cash").reduce((a, s) => a + s.total, 0);
  const creditTotal = sales.filter((s) => s.payment === "credit").reduce((a, s) => a + s.total, 0);
  const mpesaTotal = sales.filter((s) => s.payment === "mpesa").reduce((a, s) => a + s.total, 0);
  const totalReturned = Object.values(returned).reduce((a, x) => a + x, 0);
  const expectedDeposit = cashTotal + mpesaTotal;

  // Map per-product sold quantities.
  const soldByProduct: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales) for (const l of s.lines) m[l.productId] = (m[l.productId] ?? 0) + l.qty;
    return m;
  }, [sales]);

  const customerMatches = useMemo(
    () =>
      CUSTOMERS.filter(
        (c) => !customerQ || c.name.toLowerCase().includes(customerQ.toLowerCase()),
      ).slice(0, 6),
    [customerQ],
  );

  const addToCart = (pid: string) =>
    setCart((c) => {
      const ex = c.find((x) => x.productId === pid);
      if (ex) return c.map((x) => (x.productId === pid ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: pid, qty: 1, tier: "own" }];
    });

  const completeSale = () => {
    if (!cart.length) return;
    const cust = CUSTOMERS.find((c) => c.id === customer)!;
    const sale: RouteSale = {
      id: `RV-${Date.now().toString().slice(-4)}`,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      customerId: customer,
      customer: cust.name,
      lines: cart,
      total: cartTotal,
      payment,
    };
    setSales((xs) => [sale, ...xs]);
    setVisited((v) => new Set(v).add(customer));
    toast.success(t("Mauzo yamehifadhiwa", "Sale recorded"));
    setCart([]);
  };

  const generateCashUp = () => {
    if (expectedDeposit === 0) {
      toast.error(t("Hakuna cash ya kuhifadhi", "No cash to deposit yet"));
      return;
    }
    setDeposit(expectedDeposit);
    const id = `RCT-${Date.now().toString().slice(-4)}`;
    toast.success(t(`Risiti ${id} imeundwa`, `Receipt ${id} generated`));
    nav({ to: "/receipt/deposit/$id", params: { id } });
  };

  if (!user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <JoyLogo size={32} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnline((o) => !o)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${online ? "bg-[#1D9E75]/15 text-[#0f5d44]" : "bg-[#E5A100]/15 text-[#8a5a00]"}`}
              title={
                online
                  ? t("Bonyeza kuiga offline", "Click to simulate offline")
                  : t("Bonyeza kurudi online", "Click to go online")
              }
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? t("Imewasiliana", "Online") : t("Hakuna mtandao", "Offline")}
            </button>
            <button
              onClick={() => {
                logout();
                nav({ to: "/" });
              }}
              className="rounded-lg p-1.5 hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 pb-28 space-y-4">
        <div
          className="rounded-2xl text-white p-4 shadow-elevated"
          style={{ background: "linear-gradient(135deg, #14532D, #1E7C3F, #2F9E44)" }}
        >
          <div className="text-[11px] uppercase tracking-wider opacity-80">
            {t("Kipindi", "Session")}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setSession("morning")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${session === "morning" ? "bg-white text-[#14532D]" : "bg-white/15"}`}
            >
              <Sun className="h-3.5 w-3.5 inline mr-1" />
              {t("Asubuhi", "Morning")}
            </button>
            <button
              onClick={() => setSession("evening")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${session === "evening" ? "bg-white text-[#14532D]" : "bg-white/15"}`}
            >
              <Moon className="h-3.5 w-3.5 inline mr-1" />
              {t("Jioni", "Evening")}
            </button>
          </div>
          <div className="mt-3 flex justify-between text-xs opacity-85">
            <span>{user.name}</span>
            <span>{TODAY}</span>
          </div>
          <div className="mt-2 text-[11px] opacity-90">
            {t("Wateja waliotembelewa", "Customers visited")}:{" "}
            <span className="font-num font-bold">
              {visited.size}/{routeStops.length}
            </span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="plan">{t("Ratiba", "Plan")}</TabsTrigger>
            <TabsTrigger value="loadout">{t("Pakia", "Load")}</TabsTrigger>
            <TabsTrigger value="sell">{t("Uza", "Sell")}</TabsTrigger>
            <TabsTrigger value="returns">{t("Rudi", "Returns")}</TabsTrigger>
            <TabsTrigger value="cashup">{t("Fungasa", "Cash-up")}</TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t("Ratiba ya leo", "Today's route")}
              </div>
              <ul className="space-y-2">
                {routeStops.map((cid, i) => {
                  const c = CUSTOMERS.find((x) => x.id === cid)!;
                  const done = visited.has(cid);
                  return (
                    <li
                      key={cid}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${done ? "bg-[#2F9E44]/10" : "bg-secondary/60"}`}
                    >
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-[#1E7C3F] text-white" : "bg-background text-foreground"}`}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.phone}</div>
                      </div>
                      <Button
                        size="sm"
                        variant={done ? "outline" : "default"}
                        className={done ? "" : "text-white"}
                        style={
                          done
                            ? undefined
                            : { background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }
                        }
                        onClick={() => {
                          setCustomer(cid);
                          setTab("sell");
                        }}
                      >
                        {done ? t("Tena", "Again") : t("Uza", "Sell")}{" "}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="loadout" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {t("Bidhaa zilizo kwenye gari", "On the van")}
              </div>
              <ul className="space-y-2">
                {ROUTE_LOAD.map((l) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  const sold = soldByProduct[l.productId] ?? 0;
                  const remaining = Math.max(0, l.litres - sold);
                  return (
                    <li key={l.productId} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.swName}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-num font-bold">
                            {num(remaining)} / {num(l.litres)} {p.unit}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {t("Imeuzwa", "Sold")}: {num(sold)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            background: "linear-gradient(90deg, #1E7C3F, #8CC63F)",
                            width: `${(remaining / l.litres) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm font-semibold">
                <span>{t("Thamani jumla", "Total value")}</span>
                <span className="font-num">{tzs(loadedValue)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sell" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>{t("Mteja", "Customer")}</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={customerQ}
                    onChange={(e) => setCustomerQ(e.target.value)}
                    className="pl-8 h-9"
                    placeholder={t("Tafuta mteja…", "Search customer…")}
                  />
                </div>
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerMatches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ROUTE_LOAD.map((l) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  const remaining = Math.max(0, l.litres - (soldByProduct[l.productId] ?? 0));
                  return (
                    <button
                      key={l.productId}
                      disabled={remaining === 0}
                      onClick={() => addToCart(l.productId)}
                      className={`rounded-xl border border-border bg-background p-3 text-left ${remaining === 0 ? "opacity-50" : "hover:border-[#2F9E44]"}`}
                    >
                      <div className="text-xs font-semibold">{p.name}</div>
                      <div className="font-num text-sm font-bold mt-1">
                        {num(PRICE_MATRIX[p.id].own)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {num(remaining)} {p.unit} {t("zinabakia", "left")}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-1.5">
                <Label>{t("Aina ya malipo", "Payment")}</Label>
                <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                    <SelectItem value="credit">{t("Mkopo", "Credit")}</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cart.length === 0 ? null : (
                <div className="rounded-xl bg-secondary/60 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Mkokoteni", "Cart")}
                  </div>
                  {cart.map((l) => {
                    const p = PRODUCTS.find((x) => x.id === l.productId)!;
                    return (
                      <div key={l.productId} className="flex items-center gap-2">
                        <div className="flex-1 text-sm font-medium">{p.name}</div>
                        <button
                          onClick={() =>
                            setCart((c) =>
                              c
                                .map((x) =>
                                  x.productId === l.productId
                                    ? { ...x, qty: Math.max(0, x.qty - 1) }
                                    : x,
                                )
                                .filter((x) => x.qty > 0),
                            )
                          }
                          className="rounded-md bg-background p-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-num w-6 text-center">{l.qty}</span>
                        <button
                          onClick={() => addToCart(l.productId)}
                          className="rounded-md bg-background p-1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="font-num text-sm font-semibold w-20 text-right">
                          {num(PRICE_MATRIX[l.productId].own * l.qty)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span>{t("Jumla", "Total")}</span>
                    <span className="font-num">{tzs(cartTotal)}</span>
                  </div>
                </div>
              )}
              <Button
                disabled={cart.length === 0}
                className="w-full h-11 text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                onClick={completeSale}
              >
                <Receipt className="h-4 w-4 mr-1.5" /> {t("Kamilisha mauzo", "Complete sale")}
              </Button>
            </div>

            {sales.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {t("Mauzo ya leo", "Today's sales")}, {sales.length}
                </div>
                <ul className="divide-y divide-border text-sm">
                  {sales.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium">{s.customer}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.at} · {s.payment}
                        </div>
                      </div>
                      <div className="font-num font-semibold">{tzs(s.total)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="returns" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("Yaliyorudishwa", "Returned to plant")}
              </div>
              {ROUTE_LOAD.map((l) => {
                const p = PRODUCTS.find((x) => x.id === l.productId)!;
                const sold = soldByProduct[l.productId] ?? 0;
                const remaining = Math.max(0, l.litres - sold);
                return (
                  <div key={l.productId} className="rounded-xl bg-secondary/60 p-2.5">
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("Iliyobakia kwenye gari", "Remaining on van")}: {num(remaining)}{" "}
                          {p.unit}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReturned((r) => ({ ...r, [l.productId]: remaining }))}
                      >
                        {t("Rudisha yote", "Return all")}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="flex-1 text-right font-num"
                        value={returned[l.productId] ?? 0}
                        onChange={(e) =>
                          setReturned((r) => ({ ...r, [l.productId]: Number(e.target.value) }))
                        }
                      />
                      <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </div>
                  </div>
                );
              })}
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  toast.success(
                    t(`${totalReturned} units zimerekodi`, `${totalReturned} units saved`),
                  )
                }
              >
                {t("Hifadhi", "Save returns")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cashup" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="font-semibold">
                {t("Sawazisha siku", "End-of-day reconciliation")}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    [t("Mauzo (idadi)", "Sales count"), sales.length, ""],
                    [t("Cash", "Cash"), num(cashTotal), "TZS"],
                    [t("M-Pesa", "M-Pesa"), num(mpesaTotal), "TZS"],
                    [t("Mkopo", "Credit"), num(creditTotal), "TZS"],
                    [t("Imerudishwa", "Returned"), num(totalReturned), ""],
                  ].map(([k, v, suf]) => (
                    <tr key={k as string} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{k}</td>
                      <td className="py-2 text-right font-num font-semibold">
                        {v} {suf}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-semibold">
                      {t("Cash inayotarajiwa", "Expected deposit")}
                    </td>
                    <td className="py-2 text-right font-num font-bold">{tzs(expectedDeposit)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="grid gap-1.5">
                <Label>{t("Pesa iliyowekwa kwa Finance", "Deposited to finance (TZS)")}</Label>
                <Input
                  type="number"
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="font-num"
                />
              </div>
              {deposit > 0 && deposit !== expectedDeposit && (
                <div className="rounded-xl bg-[#E5A100]/10 text-[#8a5a00] text-xs px-3 py-2">
                  {t("Tofauti", "Difference")}: {tzs(deposit - expectedDeposit)}{" "}
                  {t("(eleza kwenye notes)", "(explain in notes)")}
                </div>
              )}
              <Button
                className="w-full text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                onClick={generateCashUp}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                {t("Tengeneza na chapisha", "Generate & print")}
              </Button>
              <AnimatePresence>
                {deposit > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-dashed border-border p-3 text-center"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("Hakikisho la risiti", "Deposit receipt preview")}
                    </div>
                    <div className="font-display text-lg font-bold mt-1">African Joy Dairy</div>
                    <div className="font-num text-2xl font-bold mt-2">{tzs(deposit)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {user.name} · {session}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!online && (
              <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <WifiOff className="h-3.5 w-3.5" />
                {t(
                  "Data inahifadhiwa kwenye simu, itasawazishwa ukirudi online.",
                  "Saved on device, will sync when you return online.",
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
