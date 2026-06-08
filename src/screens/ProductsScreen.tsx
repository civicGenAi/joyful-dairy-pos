import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { PRICE_MATRIX, PRODUCTS } from "@/mock/data";
import type { PriceTier, Product, ProductCategory, Unit } from "@/mock/types";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Plus, History, Search } from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";

const CATEGORIES: ProductCategory[] = ["fresh-milk", "cultured", "yoghurt", "cream", "cheese", "ghee", "butter"];

export function ProductsScreen() {
  const { t } = useApp();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [prices, setPrices] = useState(PRICE_MATRIX);
  const [showInactive, setShowInactive] = useState(true);
  const [q, setQ] = useState("");

  const visibleProducts = useMemo(() =>
    products.filter((p) =>
      (showInactive || p.active)
      && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.swName.toLowerCase().includes(q.toLowerCase()))
    ), [products, showInactive, q]);

  const setPrice = (pid: string, tier: PriceTier, v: number) =>
    setPrices((p) => ({ ...p, [pid]: { ...p[pid], [tier]: v } }));

  const toggleActive = (pid: string) =>
    setProducts((xs) => xs.map((x) => x.id === pid ? { ...x, active: !x.active } : x));

  return (
    <AppShell title={t("Bidhaa na Bei", "Products & pricing")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Bidhaa jumla", "Total products")} value={products.length} accent="green" />
        <StatCard label={t("Hai", "Active")} value={products.filter((p) => p.active).length} accent="green" />
        <StatCard label={t("Jibini, cheese SKUs", "Cheese SKUs")} value={products.filter(p => p.category === "cheese").length} accent="info" />
        <StatCard label={t("Bei tatu kwa kila SKU", "Tiers per SKU")} value={3} accent="amber" />
      </div>

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">{t("Katalogi", "Catalogue")}</TabsTrigger>
          <TabsTrigger value="prices">{t("Bei", "Price matrix")}</TabsTrigger>
          <TabsTrigger value="history">{t("Historia ya bei", "Price history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="mt-4">
          <SectionCard
            title={t("Bidhaa zote", "All products")}
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 pl-8 text-xs" placeholder={t("Tafuta…", "Search…")} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  {t("Onyesha zisizo hai", "Show inactive")}
                </label>
                <ExportMenu formats={["excel", "csv"]} filename="products" />
                <AddProductDialog onAdd={(p) => { setProducts((xs) => [...xs, p]); setPrices((px) => ({ ...px, [p.id]: { own: 0, bottle: 0, bulk: 0 } })); }} />
              </div>
            }
          >
            {visibleProducts.length === 0 ? (
              <EmptyState title={t("Hakuna bidhaa", "No products match")} description={t("Badilisha kichujio au utafutaji.", "Adjust the filter or search.")} />
            ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Jina", "Name")}</th><th>{t("Kiswahili", "Swahili")}</th><th>{t("Kategoria", "Category")}</th><th>{t("Kipimo", "Unit")}</th><th>{t("Note", "Conversion")}</th><th>{t("Hai", "Active")}</th>
              </tr></thead>
              <tbody>
                {visibleProducts.map((p) => (
                  <tr key={p.id} className={`border-b border-border last:border-0 ${!p.active ? "opacity-60" : ""}`}>
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.swName}</td>
                    <td className="py-2.5"><Pill tone="info">{p.category}</Pill></td>
                    <td className="py-2.5 font-num">{p.unit}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{p.conversionNote ?? "·"}</td>
                    <td className="py-2.5"><Switch checked={p.active} onCheckedChange={() => toggleActive(p.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="prices" className="mt-4">
          <SectionCard
            title={t("Bei (TZS), inahaririwa", "Price matrix (TZS), editable")}
            action={<Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Bei zimehifadhiwa", "Prices saved"))}><Save className="h-3.5 w-3.5 mr-1.5" />{t("Hifadhi", "Save")}</Button>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
                  <th className="text-right px-3">{t("Chombo cha mteja", "Own container")}</th>
                  <th className="text-right px-3">{t("Pamoja na chupa", "With bottle")}</th>
                  <th className="text-right px-3">{t("Jumla / dozeni", "Bulk / dozen")}</th>
                </tr></thead>
                <tbody>
                  {products.filter((p) => p.active).map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-medium">{p.name} <span className="text-xs text-muted-foreground">/{p.unit}</span></td>
                      {(["own", "bottle", "bulk"] as PriceTier[]).map((tier) => (
                        <td key={tier} className="py-1.5 px-3 text-right">
                          <Input value={prices[p.id]?.[tier] ?? 0} onChange={(e) => setPrice(p.id, tier, Number(e.target.value))} className="h-8 w-28 ml-auto text-right font-num" type="number" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {t("Mabadiliko huingia kwa hesabu mpya. Bei za zamani zimehifadhiwa kwenye 'Historia ya bei'.", "Changes take effect for new sales. Past prices are kept in the price-history tab.")}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SectionCard title={t("Historia ya mabadiliko ya bei", "Recent price changes")} action={<History className="h-4 w-4 text-muted-foreground" />}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                <th>{t("Bidhaa", "Product")}</th>
                <th>{t("Bei", "Tier")}</th>
                <th className="text-right">{t("Zamani", "Was")}</th>
                <th className="text-right">{t("Sasa", "Now")}</th>
                <th>{t("Aliyebadilisha", "By")}</th>
              </tr></thead>
              <tbody>
                {[
                  { d: "2026-05-22", p: "Fresh milk", tier: "own", was: 1400, now: 1500, by: "Joyce" },
                  { d: "2026-05-18", p: "Mozzarella", tier: "bulk", was: 13000, now: 13500, by: "Joyce" },
                  { d: "2026-05-10", p: "Ghee", tier: "bottle", was: 18500, now: 19000, by: "Asha" },
                  { d: "2026-05-05", p: "Mtindi", tier: "bottle", was: 1800, now: 2000, by: "Joyce" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{row.d}</td>
                    <td className="py-2.5 font-medium">{row.p}</td>
                    <td className="py-2.5"><Pill tone="info">{row.tier}</Pill></td>
                    <td className="py-2.5 text-right font-num text-muted-foreground">{row.was}</td>
                    <td className="py-2.5 text-right font-num font-semibold">{row.now}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{row.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AddProductDialog({ onAdd }: { onAdd: (p: Product) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [swName, setSwName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("yoghurt");
  const [unit, setUnit] = useState<Unit>("pcs");
  const [conversionNote, setConversionNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Bidhaa mpya", "New product")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Ongeza bidhaa mpya kwenye katalogi", "Add new product to catalogue")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Jina (English)", "Name (English)")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yoghurt Mango 500ml" /></div>
            <div className="grid gap-1.5"><Label>{t("Jina la Kiswahili", "Swahili name")}</Label><Input value={swName} onChange={(e) => setSwName(e.target.value)} placeholder="Yogati Maembe" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Kategoria", "Category")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>{t("Kipimo", "Unit")}</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L (litres)</SelectItem>
                  <SelectItem value="kg">kg (kilograms)</SelectItem>
                  <SelectItem value="pcs">pcs (pieces)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Maelezo ya ubadilishaji (hiari)", "Conversion note (optional)")}</Label><Input value={conversionNote} onChange={(e) => setConversionNote(e.target.value)} placeholder="244 L ≈ 20 kg" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => {
            if (!name.trim()) return;
            onAdd({
              id: `p-new-${Date.now()}`,
              name,
              swName: swName || name,
              category,
              unit,
              conversionNote: conversionNote || undefined,
              active: true,
            });
            toast.success(t("Bidhaa imeongezwa", "Product added"));
            setOpen(false);
            setName(""); setSwName(""); setConversionNote("");
          }} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
