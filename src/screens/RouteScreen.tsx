import { useApp } from "@/app/context";
import { Navigate } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CUSTOMERS, PRODUCTS, PRICE_MATRIX, ROUTE_LOAD } from "@/mock/data";
import { tzs, L, num } from "@/lib/format";
import { Pill } from "@/components/ui/data-bits";
import { useState } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff, Sun, Moon, Truck, Plus, Minus, Trash2, Receipt, RotateCcw, LogOut, Menu } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

interface CartLine { productId: string; qty: number; tier: "own" | "bottle" | "bulk"; }

export function RouteScreen() {
  const { user, t, logout } = useApp();
  const nav = useNavigate();
  if (!user) return <Navigate to="/" />;

  const [tab, setTab] = useState("loadout");
  const [session, setSession] = useState<"morning" | "evening">("morning");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState(CUSTOMERS[0].id);
  const [payment, setPayment] = useState("cash");
  const [returned, setReturned] = useState({ "p-fresh": 8, "p-mtindi": 4 });
  const [deposit, setDeposit] = useState(540000);

  const addToCart = (pid: string) => setCart((c) => {
    const ex = c.find((x) => x.productId === pid);
    if (ex) return c.map((x) => x.productId === pid ? { ...x, qty: x.qty + 1 } : x);
    return [...c, { productId: pid, qty: 1, tier: "own" }];
  });

  const cartTotal = cart.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);
  const loadedValue = ROUTE_LOAD.reduce((a, l) => a + PRICE_MATRIX[l.productId].own * l.litres, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-feel header */}
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <JoyLogo size={32} />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1D9E75]/15 text-[#0f5d44] px-2 py-1 text-[10px] font-semibold">
              <Wifi className="h-3 w-3" /> {t("Imewasiliana", "Online")}
            </span>
            <button onClick={() => { logout(); nav({ to: "/" }); }} className="rounded-lg p-1.5 hover:bg-accent"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 pb-28 space-y-4">
        <div className="rounded-2xl text-white p-4 shadow-elevated" style={{ background: "linear-gradient(135deg, #14532D, #1E7C3F, #2F9E44)" }}>
          <div className="text-[11px] uppercase tracking-wider opacity-80">{t("Kipindi", "Session")}</div>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setSession("morning")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${session === "morning" ? "bg-white text-[#14532D]" : "bg-white/15"}`}><Sun className="h-3.5 w-3.5 inline mr-1" />{t("Asubuhi", "Morning")}</button>
            <button onClick={() => setSession("evening")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${session === "evening" ? "bg-white text-[#14532D]" : "bg-white/15"}`}><Moon className="h-3.5 w-3.5 inline mr-1" />{t("Jioni", "Evening")}</button>
          </div>
          <div className="mt-3 flex justify-between text-xs opacity-85"><span>{user.name}</span><span>{new Date().toLocaleDateString()}</span></div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="loadout">{t("Pakia", "Load out")}</TabsTrigger>
            <TabsTrigger value="sell">{t("Uza", "Sell")}</TabsTrigger>
            <TabsTrigger value="returns">{t("Rudi", "Returns")}</TabsTrigger>
            <TabsTrigger value="cashup">{t("Fungasa", "Cash-up")}</TabsTrigger>
          </TabsList>

          {/* LOAD OUT */}
          <TabsContent value="loadout" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="font-semibold mb-3 flex items-center gap-2"><Truck className="h-4 w-4" />{t("Bidhaa zilizo kwenye gari", "On the van")}</div>
              <ul className="space-y-2">
                {ROUTE_LOAD.map((l) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  return (
                    <li key={l.productId} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5">
                      <div>
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.swName}</div>
                      </div>
                      <div className="font-num font-bold">{num(l.litres)} {p.unit}</div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm font-semibold"><span>{t("Thamani jumla", "Total value")}</span><span className="font-num">{tzs(loadedValue)}</span></div>
            </div>
          </TabsContent>

          {/* SELL */}
          <TabsContent value="sell" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="grid gap-1.5"><Label>{t("Mteja", "Customer")}</Label>
                <Select value={customer} onValueChange={setCustomer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ROUTE_LOAD.map((l) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  return (
                    <button key={l.productId} onClick={() => addToCart(l.productId)} className="rounded-xl border border-border bg-background p-3 text-left hover:border-[#2F9E44]">
                      <div className="text-xs font-semibold">{p.name}</div>
                      <div className="font-num text-sm font-bold mt-1">{num(PRICE_MATRIX[p.id].own)}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-1.5"><Label>{t("Aina ya malipo", "Payment")}</Label>
                <Select value={payment} onValueChange={setPayment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                  <SelectItem value="credit">{t("Mkopo", "Credit")}</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent></Select>
              </div>

              {cart.length === 0 ? null : (
                <div className="rounded-xl bg-secondary/60 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Mkokoteni", "Cart")}</div>
                  {cart.map((l) => {
                    const p = PRODUCTS.find((x) => x.id === l.productId)!;
                    return (
                      <div key={l.productId} className="flex items-center gap-2">
                        <div className="flex-1 text-sm font-medium">{p.name}</div>
                        <button onClick={() => setCart((c) => c.map((x) => x.productId === l.productId ? { ...x, qty: Math.max(0, x.qty - 1) } : x).filter((x) => x.qty > 0))} className="rounded-md bg-background p-1"><Minus className="h-3 w-3" /></button>
                        <span className="font-num w-6 text-center">{l.qty}</span>
                        <button onClick={() => addToCart(l.productId)} className="rounded-md bg-background p-1"><Plus className="h-3 w-3" /></button>
                        <span className="font-num text-sm font-semibold w-20 text-right">{num(PRICE_MATRIX[l.productId].own * l.qty)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-border pt-2 flex justify-between font-bold"><span>{t("Jumla", "Total")}</span><span className="font-num">{tzs(cartTotal)}</span></div>
                </div>
              )}
              <Button disabled={cart.length === 0} className="w-full h-11 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => { toast.success(t("Mauzo yamehifadhiwa", "Sale recorded")); setCart([]); }}>
                <Receipt className="h-4 w-4 mr-1.5" /> {t("Kamilisha mauzo", "Complete sale")}
              </Button>
            </div>
          </TabsContent>

          {/* RETURNS */}
          <TabsContent value="returns" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><RotateCcw className="h-4 w-4" />{t("Yaliyorudishwa", "Returned to plant")}</div>
              {Object.keys(returned).map((pid) => {
                const p = PRODUCTS.find((x) => x.id === pid)!;
                return (
                  <div key={pid} className="flex items-center gap-2">
                    <div className="flex-1 text-sm font-medium">{p.name}</div>
                    <Input type="number" className="w-24 text-right font-num" value={(returned as any)[pid]} onChange={(e) => setReturned((r) => ({ ...r, [pid]: Number(e.target.value) }))} />
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </div>
                );
              })}
              <Button variant="outline" className="w-full" onClick={() => toast.success(t("Imerekodi marejesho", "Returns saved"))}>{t("Hifadhi", "Save returns")}</Button>
            </div>
          </TabsContent>

          {/* CASHUP */}
          <TabsContent value="cashup" className="space-y-3 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="font-semibold">{t("Sawazisha siku", "End-of-day reconciliation")}</div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    [t("Imepakiwa", "Loaded"), 180],
                    [t("Imeuzwa (cash)", "Sold cash"), 96],
                    [t("Imeuzwa (mkopo)", "Sold credit"), 42],
                    [t("Imerudi", "Returned"), 12],
                    [t("Imeharibika", "Spoilt"), 2],
                  ].map(([k, v]) => (
                    <tr key={k as string} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{k}</td>
                      <td className="py-2 text-right font-num font-semibold">{num(v as number)} L</td>
                    </tr>
                  ))}
                  <tr><td className="py-2 font-semibold">{t("Cash inayotarajiwa", "Expected cash")}</td><td className="py-2 text-right font-num font-bold">{tzs(540000)}</td></tr>
                </tbody>
              </table>
              <div className="grid gap-1.5"><Label>{t("Pesa iliyowekwa kwa Finance", "Deposited to finance (TZS)")}</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="font-num" /></div>
              <Button className="w-full text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Risiti imeundwa: RCT-5821", "Receipt generated: RCT-5821"))}>{t("Tengeneza risiti", "Generate receipt")}</Button>
              <AnimatePresence>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-dashed border-border p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Hakikisho la risiti", "Deposit receipt preview")}</div>
                  <div className="font-display text-lg font-bold mt-1">African Joy Dairy</div>
                  <div className="text-xs text-muted-foreground">{t("Risiti namba", "Receipt no.")}: <span className="font-num">RCT-5821</span></div>
                  <div className="mt-2 font-num text-2xl font-bold">{tzs(deposit)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{user.name} · {session}</div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5" />{t("Data inahifadhiwa kwenye simu, itasawazishwa", "Saved on device, will sync when online")}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
