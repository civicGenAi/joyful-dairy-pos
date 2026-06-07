import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { PRODUCTS, PRICE_MATRIX, CUSTOMERS } from "@/mock/data";
import type { PriceTier, ProductCategory } from "@/mock/types";
import { tzs, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, SectionCard } from "@/components/ui/data-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Printer, ShoppingBasket } from "lucide-react";
import { motion } from "framer-motion";

const CATS: { id: ProductCategory; label: { sw: string; en: string }; color: string }[] = [
  { id: "fresh-milk", label: { sw: "Maziwa Fresh", en: "Fresh milk" }, color: "#1E7C3F" },
  { id: "cultured", label: { sw: "Mtindi", en: "Cultured" }, color: "#2F9E44" },
  { id: "yoghurt", label: { sw: "Yogati", en: "Yoghurt" }, color: "#6FBF59" },
  { id: "cream", label: { sw: "Krimu", en: "Cream" }, color: "#8CC63F" },
  { id: "cheese", label: { sw: "Jibini", en: "Cheese" }, color: "#1D9E75" },
  { id: "ghee", label: { sw: "Samli", en: "Ghee" }, color: "#E5A100" },
  { id: "butter", label: { sw: "Siagi", en: "Butter" }, color: "#E11B22" },
];

interface CartLine { productId: string; qty: number; tier: PriceTier; }

export function POSScreen() {
  const { t, lang } = useApp();
  const [cat, setCat] = useState<ProductCategory>("fresh-milk");
  const [tier, setTier] = useState<PriceTier>("own");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("walkin");
  const [pay, setPay] = useState("cash");
  const [receipt, setReceipt] = useState<null | { id: string; total: number; lines: CartLine[] }>(null);

  const products = PRODUCTS.filter((p) => p.category === cat && p.active);

  const add = (pid: string) => setCart((c) => {
    const ex = c.find((x) => x.productId === pid && x.tier === tier);
    if (ex) return c.map((x) => x === ex ? { ...x, qty: x.qty + 1 } : x);
    return [...c, { productId: pid, qty: 1, tier }];
  });
  const total = cart.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);

  return (
    <AppShell title={t("Mauzo ya Kaunta", "Counter POS")}>
      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">{t("POS", "POS")}</TabsTrigger>
          <TabsTrigger value="orders">{t("Orders / utoaji wa stock", "Orders / stock issue")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Left: products */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {CATS.map((c) => (
                    <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${cat === c.id ? "text-white shadow-card" : "bg-secondary text-foreground hover:bg-accent"}`} style={cat === c.id ? { background: c.color } : undefined}>
                      {lang === "sw" ? c.label.sw : c.label.en}
                    </button>
                  ))}
                </div>
                <Select value={tier} onValueChange={(v) => setTier(v as PriceTier)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">{t("Chombo cha mteja", "Own container")}</SelectItem>
                    <SelectItem value="bottle">{t("Pamoja na chupa", "With bottle")}</SelectItem>
                    <SelectItem value="bulk">{t("Bei ya jumla / dozeni", "Bulk / dozen")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => add(p.id)}
                    className="text-left rounded-xl border border-border bg-background p-3 hover:border-[#2F9E44] hover:shadow-card transition"
                  >
                    <div className="aspect-[16/9] rounded-lg mb-2" style={{ background: `linear-gradient(135deg, ${CATS.find((c) => c.id === cat)?.color}30, ${CATS.find((c) => c.id === cat)?.color}10)` }} />
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.swName}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-num font-bold">{num(PRICE_MATRIX[p.id][tier])}</span>
                      <Pill tone="success">{p.unit}</Pill>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Right: cart */}
            <div className="rounded-2xl border border-border bg-card shadow-card flex flex-col">
              <div className="px-4 py-3 border-b border-border font-display font-semibold flex items-center gap-2"><ShoppingBasket className="h-4 w-4" />{t("Mkokoteni", "Cart")} ({cart.length})</div>
              <div className="p-3 border-b border-border space-y-2">
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("Mteja wa kupita", "Walk-in")}</SelectItem>
                    {CUSTOMERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.type !== "cash" && <span className="text-xs text-muted-foreground ml-2">({c.type})</span>}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={pay} onValueChange={setPay}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                    <SelectItem value="credit">{t("Mkopo", "Credit")}</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="stock">{t("Utoaji wa stock", "Stock issue")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 max-h-[400px]">
                {cart.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">{t("Bonyeza bidhaa kuongeza", "Tap a product to add")}</div>}
                {cart.map((l, i) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!;
                  return (
                    <div key={i} className="rounded-xl bg-secondary/60 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">{l.tier} · {num(PRICE_MATRIX[p.id][l.tier])}/{p.unit}</div>
                        </div>
                        <button onClick={() => setCart((c) => c.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-[#E11B22]"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => setCart((c) => c.map((x, k) => k === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="rounded-md bg-background p-1"><Minus className="h-3 w-3" /></button>
                        <span className="font-num w-8 text-center text-sm font-semibold">{l.qty}</span>
                        <button onClick={() => setCart((c) => c.map((x, k) => k === i ? { ...x, qty: x.qty + 1 } : x))} className="rounded-md bg-background p-1"><Plus className="h-3 w-3" /></button>
                        <span className="ml-auto font-num font-bold text-sm">{tzs(PRICE_MATRIX[l.productId][l.tier] * l.qty)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex justify-between text-sm"><span>{t("Bidhaa", "Items")}</span><span className="font-num">{cart.reduce((a, l) => a + l.qty, 0)}</span></div>
                <div className="flex justify-between text-lg font-bold"><span>{t("Jumla", "Total")}</span><span className="font-num">{tzs(total)}</span></div>
                <Button disabled={cart.length === 0} onClick={() => { setReceipt({ id: `RCT-${Math.floor(Math.random() * 9000 + 1000)}`, total, lines: cart }); toast.success(t("Mauzo yamehifadhiwa", "Sale completed")); setCart([]); }} className="w-full h-11 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>{t("Kamilisha mauzo", "Complete sale")}</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <SectionCard title={t("Orders zilizotolewa kwa stock", "Direct orders fulfilled from stock")}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-2">#</th><th>{t("Mteja", "Customer")}</th><th>{t("Bidhaa", "Product")}</th><th className="text-right">{t("Idadi", "Qty")}</th><th className="text-right">{t("Jumla", "Total")}</th><th>{t("Hali", "Status")}</th>
              </tr></thead>
              <tbody>
                {[
                  { c: "Mamis Bistro", p: "Mozzarella", q: "3 kg", a: 42000, s: "issued" },
                  { c: "CSR Hotel", p: "Fresh milk", q: "40 L", a: 60000, s: "issued" },
                  { c: "Jovinary Hotel", p: "Mtindi", q: "30 L", a: 51000, s: "pending" },
                  { c: "Sidhu Restaurant", p: "Yoghurt Vanilla", q: "24 pcs", a: 60000, s: "issued" },
                ].map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-2 font-num text-xs text-muted-foreground">{1000 + i}</td>
                    <td className="py-2.5 font-medium">{r.c}</td>
                    <td className="py-2.5">{r.p}</td>
                    <td className="py-2.5 text-right font-num">{r.q}</td>
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(r.a)}</td>
                    <td className="py-2.5"><Pill tone={r.s === "issued" ? "success" : "warning"}>{r.s}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Risiti", "Receipt")}</DialogTitle></DialogHeader>
          {receipt && (
            <div className="rounded-xl border border-dashed border-border p-4 font-mono text-sm">
              <div className="text-center font-display font-bold">African Joy Dairy</div>
              <div className="text-center text-xs text-muted-foreground">Arusha · {new Date().toLocaleString()}</div>
              <div className="text-center text-xs mt-1">{t("Risiti", "Receipt")}: <span className="font-semibold">{receipt.id}</span></div>
              <hr className="my-3" />
              {receipt.lines.map((l, i) => {
                const p = PRODUCTS.find((x) => x.id === l.productId)!;
                return (
                  <div key={i} className="flex justify-between"><span>{p.name} × {l.qty}</span><span>{num(PRICE_MATRIX[l.productId][l.tier] * l.qty)}</span></div>
                );
              })}
              <hr className="my-3" />
              <div className="flex justify-between font-bold text-base"><span>{t("Jumla", "Total")}</span><span>{tzs(receipt.total)}</span></div>
              <div className="text-center text-[10px] text-muted-foreground mt-3">{t("Asante kwa kuchagua African Joy", "Thank you for choosing African Joy")}</div>
            </div>
          )}
          <Button onClick={() => { toast.success(t("Imechapishwa", "Printed")); setReceipt(null); }} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><Printer className="h-4 w-4 mr-1.5" />{t("Chapisha", "Print")}</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
