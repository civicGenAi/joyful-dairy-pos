import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/products (was @/mock/data).
import {
  useProducts,
  usePriceMatrix,
  usePriceHistory,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useSetProductActive,
  useSetPrice,
} from "@/lib/data/hooks/products";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Product } from "@/mock/types";
import type { PriceTier, ProductCategory, Unit } from "@/mock/types";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Plus, History, Search, Tag } from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";

// The real catalogue is Mtindi (cultured), cheese, yoghurt, and fresh milk
// (sold directly in sized containers, e.g. Fresh milk 3L/5L). Only the one
// specific "Fresh milk" product (p-fresh) is internal plumbing, tracking
// raw milk through collection/production, that restriction is on that one
// product id, not the whole category, other fresh-milk products are real.
const CATEGORIES: ProductCategory[] = ["cultured", "cheese", "yoghurt", "fresh-milk"];

const TIERS: PriceTier[] = ["own", "bottle", "bulk"];

export function ProductsScreen() {
  const { t, can } = useApp();
  const canWrite = can("products:write");
  const canPrice = can("prices:write");
  const { data: products = [], isPending, isError, refetch } = useProducts();
  const { data: prices = {} } = usePriceMatrix();
  const setActive = useSetProductActive();
  const setPriceMut = useSetPrice();
  const [showInactive, setShowInactive] = useState(true);
  const [q, setQ] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // Local edits overlay the server matrix until "Save" pushes them as new
  // price-list entries (price history stays first-class).
  const [edited, setEdited] = useState<Record<string, Partial<Record<PriceTier, number>>>>({});

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (showInactive || p.active) &&
          (!q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.swName.toLowerCase().includes(q.toLowerCase()) ||
            p.category.toLowerCase().includes(q.toLowerCase()) ||
            p.id.toLowerCase().includes(q.toLowerCase())),
      ),
    [products, showInactive, q],
  );

  const priceOf = (pid: string, tier: PriceTier) => edited[pid]?.[tier] ?? prices[pid]?.[tier] ?? 0;

  const setPrice = (pid: string, tier: PriceTier, v: number) =>
    setEdited((e) => ({ ...e, [pid]: { ...e[pid], [tier]: v } }));

  const savePrices = async () => {
    const changes: { pid: string; tier: PriceTier; oldValue: number; value: number }[] = [];
    for (const [pid, tiers] of Object.entries(edited)) {
      for (const [tier, value] of Object.entries(tiers) as [PriceTier, number][]) {
        const oldValue = prices[pid]?.[tier] ?? 0;
        if (value !== oldValue) changes.push({ pid, tier, oldValue, value });
      }
    }
    if (changes.length === 0) {
      toast(t("Hakuna mabadiliko ya bei", "No price changes to save"));
      return;
    }
    try {
      for (const c of changes) {
        await setPriceMut.mutateAsync({
          productId: c.pid,
          productName: products.find((p) => p.id === c.pid)?.name ?? c.pid,
          tier: c.tier,
          oldValue: c.oldValue,
          value: c.value,
        });
      }
      setEdited({});
      toast.success(t("Bei zimehifadhiwa", "Prices saved"));
    } catch {
      toast.error(t("Imeshindikana kuhifadhi bei", "Could not save prices"));
    }
  };

  if (isPending) {
    return (
      <AppShell title={t("Bidhaa na Bei", "Products & pricing")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={6} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title={t("Bidhaa na Bei", "Products & pricing")}>
        <EmptyState
          icon={Tag}
          title={t("Imeshindikana kupakia bidhaa", "Could not load products")}
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
    <AppShell title={t("Bidhaa na Bei", "Products & pricing")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Bidhaa jumla", "Total products")}
          value={products.length}
          accent="green"
        />
        <StatCard
          label={t("Hai", "Active")}
          value={products.filter((p) => p.active).length}
          accent="green"
        />
        <StatCard
          label={t("Jibini, cheese SKUs", "Cheese SKUs")}
          value={products.filter((p) => p.category === "cheese").length}
          accent="info"
        />
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
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-8 w-56 pl-8 text-xs"
                    placeholder={t("Tafuta…", "Search…")}
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  {t("Onyesha zisizo hai", "Show inactive")}
                </label>
                <ExportMenu
                  formats={["excel", "csv", "pdf"]}
                  filename="products"
                  data={() => ({
                    title: t("Katalogi ya bidhaa", "Product catalogue"),
                    headers: [
                      "Name",
                      "Swahili",
                      "Category",
                      "Unit",
                      "Own",
                      "Bottle",
                      "Bulk",
                      "Active",
                    ],
                    rows: visibleProducts.map((p) => [
                      p.name,
                      p.swName,
                      p.category,
                      p.unit,
                      prices[p.id]?.own ?? 0,
                      prices[p.id]?.bottle ?? 0,
                      prices[p.id]?.bulk ?? 0,
                      p.active ? "yes" : "no",
                    ]),
                  })}
                />
                {canWrite && <AddProductDialog />}
              </div>
            }
          >
            {visibleProducts.length === 0 ? (
              <EmptyState
                title={t("Hakuna bidhaa", "No products match")}
                description={t("Badilisha kichujio au utafutaji.", "Adjust the filter or search.")}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Jina", "Name")}</th>
                    <th>{t("Kiswahili", "Swahili")}</th>
                    <th>{t("Kategoria", "Category")}</th>
                    <th>{t("Kipimo", "Unit")}</th>
                    <th>{t("Note", "Conversion")}</th>
                    <th>{t("Hai", "Active")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setViewingId(p.id)}
                      className={`border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer ${!p.active ? "opacity-60" : ""}`}
                    >
                      <td className="py-2.5 px-3 font-medium">{p.name}</td>
                      <td className="py-2.5 text-muted-foreground">{p.swName}</td>
                      <td className="py-2.5">
                        <Pill tone="info">{p.category}</Pill>
                      </td>
                      <td className="py-2.5 font-num">{p.unit}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {p.conversionNote ?? "·"}
                      </td>
                      <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={p.active}
                          disabled={!canWrite}
                          onCheckedChange={(checked) =>
                            setActive.mutate(
                              { id: p.id, name: p.name, active: checked },
                              {
                                onError: () =>
                                  toast.error(t("Imeshindikana kubadilisha", "Could not update")),
                              },
                            )
                          }
                        />
                      </td>
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
            action={
              <Button
                size="sm"
                className="text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                disabled={!canPrice || setPriceMut.isPending}
                onClick={savePrices}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {setPriceMut.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
                    <th className="text-right px-3">{t("Chombo cha mteja", "Own container")}</th>
                    <th className="text-right px-3">{t("Pamoja na chupa", "With bottle")}</th>
                    <th className="text-right px-3">{t("Jumla / dozeni", "Bulk / dozen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter((p) => p.active)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">
                          {p.name} <span className="text-xs text-muted-foreground">/{p.unit}</span>
                        </td>
                        {TIERS.map((tier) => (
                          <td key={tier} className="py-1.5 px-3 text-right">
                            <Input
                              value={priceOf(p.id, tier)}
                              onChange={(e) => setPrice(p.id, tier, Number(e.target.value))}
                              className="h-8 w-28 ml-auto text-right font-num"
                              type="number"
                              readOnly={!canPrice}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {t(
                "Mabadiliko huingia kwa hesabu mpya. Bei za zamani zimehifadhiwa kwenye 'Historia ya bei'.",
                "Changes take effect for new sales. Past prices are kept in the price-history tab.",
              )}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PriceHistoryTab />
        </TabsContent>
      </Tabs>

      {viewingId && (
        <ProductSheet
          product={products.find((p) => p.id === viewingId)!}
          onClose={() => setViewingId(null)}
        />
      )}
    </AppShell>
  );
}

function PriceHistoryTab() {
  const { t } = useApp();
  const { data: history = [] } = usePriceHistory();
  const { data: products = [] } = useProducts();
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  // "Was" = the next-older entry for the same product + tier.
  const rows = useMemo(
    () =>
      history.map((h) => {
        const older = history.find(
          (x) =>
            x.productId === h.productId &&
            x.tier === h.tier &&
            (x.effectiveFrom < h.effectiveFrom ||
              (x.effectiveFrom === h.effectiveFrom && x.id !== h.id && x.value !== h.value)),
        );
        return { ...h, was: older?.value ?? null };
      }),
    [history],
  );

  return (
    <SectionCard
      title={t("Historia ya mabadiliko ya bei", "Recent price changes")}
      action={<History className="h-4 w-4 text-muted-foreground" />}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("Hakuna historia ya bei bado", "No price history yet")}
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
              <th>{t("Bidhaa", "Product")}</th>
              <th>{t("Bei", "Tier")}</th>
              <th className="text-right">{t("Zamani", "Was")}</th>
              <th className="text-right">{t("Sasa", "Now")}</th>
              <th>{t("Aliyebadilisha", "By")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                  {row.effectiveFrom}
                </td>
                <td className="py-2.5 font-medium">{productName(row.productId)}</td>
                <td className="py-2.5">
                  <Pill tone="info">{row.tier}</Pill>
                </td>
                <td className="py-2.5 text-right font-num text-muted-foreground">
                  {row.was ?? "·"}
                </td>
                <td className="py-2.5 text-right font-num font-semibold">{row.value}</td>
                <td className="py-2.5 text-xs text-muted-foreground">{row.byName ?? "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

function AddProductDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [swName, setSwName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("yoghurt");
  const [unit, setUnit] = useState<Unit>("pcs");
  const [conversionNote, setConversionNote] = useState("");
  const [yieldPct, setYieldPct] = useState<number | "">("");
  const create = useCreateProduct();
  const producible = category !== "fresh-milk";

  const save = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name,
        swName: swName || name,
        category,
        unit,
        conversionNote: conversionNote || undefined,
        defaultYieldPct: producible && yieldPct !== "" ? Number(yieldPct) : undefined,
        prices: { own: 0, bottle: 0, bulk: 0 },
      },
      {
        onSuccess: () => {
          toast.success(t("Bidhaa imeongezwa", "Product added"));
          setOpen(false);
          setName("");
          setSwName("");
          setConversionNote("");
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add product")),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Bidhaa mpya", "New product")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>
            {t("Ongeza bidhaa mpya kwenye katalogi", "Add new product to catalogue")}
          </SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Jina (English)", "Name (English)")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Yoghurt Mango 500ml"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Jina la Kiswahili", "Swahili name")}</Label>
              <Input
                value={swName}
                onChange={(e) => setSwName(e.target.value)}
                placeholder="Yogati Maembe"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kategoria", "Category")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kipimo", "Unit")}</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L (litres)</SelectItem>
                  <SelectItem value="kg">kg (kilograms)</SelectItem>
                  <SelectItem value="pcs">pcs (pieces)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo ya ubadilishaji (hiari)", "Conversion note (optional)")}</Label>
            <Input
              value={conversionNote}
              onChange={(e) => setConversionNote(e.target.value)}
              placeholder="244 L ≈ 20 kg"
            />
          </div>
          {producible && (
            <div className="grid gap-1.5">
              <Label>{t("Mavuno % (hiari)", "Default yield % (optional)")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                max={100}
                value={yieldPct}
                onChange={(e) => setYieldPct(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="9.5"
              />
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Ukijaza hii, Uzalishaji utakokotoa toleo na hasara moja kwa moja kutoka lita za maziwa ghafi.",
                  "If set, Production will compute output and wastage automatically from raw milk litres.",
                )}
              </div>
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={create.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProductSheet({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const { t, can } = useApp();
  const canWrite = can("products:write");
  const canPrice = can("prices:write");
  const { data: prices = {} } = usePriceMatrix();
  const update = useUpdateProduct();
  const remove = useDeleteProduct();
  const setActive = useSetProductActive();
  const setPriceMut = useSetPrice();

  const [name, setName] = useState(p.name);
  const [swName, setSwName] = useState(p.swName);
  const [category, setCategory] = useState<ProductCategory>(p.category);
  const [unit, setUnit] = useState<Unit>(p.unit);
  const [note, setNote] = useState(p.conversionNote ?? "");
  const [yieldPct, setYieldPct] = useState<number | "">(p.defaultYieldPct ?? "");
  const [tierEdits, setTierEdits] = useState<Partial<Record<PriceTier, number>>>({});
  const priceOf = (tier: PriceTier) => tierEdits[tier] ?? prices[p.id]?.[tier] ?? 0;
  const producible = category !== "fresh-milk";
  // Keeps a legacy category (fresh-milk/cream/ghee/butter from the old demo
  // catalogue) selectable on its own product so editing it doesn't silently
  // reset the value, without offering it for anything else.
  const categoryOptions = CATEGORIES.includes(p.category)
    ? CATEGORIES
    : [...CATEGORIES, p.category];

  const saveDetails = () => {
    update.mutate(
      {
        id: p.id,
        name,
        swName,
        category,
        unit,
        conversionNote: note || undefined,
        defaultYieldPct: producible && yieldPct !== "" ? Number(yieldPct) : undefined,
      },
      {
        onSuccess: () => toast.success(t("Bidhaa imehifadhiwa", "Product saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save product")),
      },
    );
  };

  const savePrices = async () => {
    const changes = TIERS.filter(
      (tier) => tierEdits[tier] !== undefined && tierEdits[tier] !== (prices[p.id]?.[tier] ?? 0),
    );
    if (changes.length === 0) {
      toast(t("Hakuna mabadiliko ya bei", "No price changes to save"));
      return;
    }
    try {
      for (const tier of changes) {
        await setPriceMut.mutateAsync({
          productId: p.id,
          productName: p.name,
          tier,
          oldValue: prices[p.id]?.[tier] ?? 0,
          value: tierEdits[tier]!,
        });
      }
      setTierEdits({});
      toast.success(t("Bei zimehifadhiwa", "Prices saved"));
    } catch {
      toast.error(t("Imeshindikana kuhifadhi bei", "Could not save prices"));
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <div>{p.name}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {p.swName} · {p.category} · {p.unit}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Status + quick actions */}
        <div className="mt-5 flex items-center gap-2">
          <Pill tone={p.active ? "success" : "slate"}>
            {p.active ? t("Inauzwa", "On sale") : t("Imesimamishwa", "Suspended")}
          </Pill>
          {canWrite && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={setActive.isPending}
                onClick={() =>
                  setActive.mutate(
                    { id: p.id, name: p.name, active: !p.active },
                    {
                      onSuccess: () =>
                        toast.success(
                          p.active
                            ? t("Bidhaa imesimamishwa", "Product suspended")
                            : t("Bidhaa imerudishwa", "Product back on sale"),
                        ),
                      onError: () => toast.error(t("Imeshindikana", "Could not update")),
                    },
                  )
                }
              >
                {p.active ? t("Simamisha", "Suspend") : t("Rudisha", "Reinstate")}
              </Button>
              <ConfirmDialog
                destructive
                title={t("Futa bidhaa?", "Delete product?")}
                description={t(
                  "Bidhaa itaondolewa kwenye maduka na bei, historia yake itabaki salama. Unaweza kuirudisha kutoka Mipangilio > Tupio.",
                  "The product will be removed from POS and pricing, its history stays intact. You can restore it from Settings > Trash.",
                )}
                confirmLabel={t("Futa", "Delete")}
                onConfirm={() =>
                  remove.mutate(
                    { id: p.id, name: p.name },
                    {
                      onSuccess: () => {
                        toast.success(t("Bidhaa imefutwa", "Product deleted"));
                        onClose();
                      },
                      onError: () =>
                        toast.error(
                          t(
                            "Haiwezekani: bidhaa ina historia ya mauzo. Itumie 'Simamisha'.",
                            "Not possible: the product has sales history. Use 'Suspend' instead.",
                          ),
                        ),
                    },
                  )
                }
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-[#E11B22] border-[#E11B22]"
                  >
                    {t("Futa", "Delete")}
                  </Button>
                }
              />
            </>
          )}
        </div>

        {/* Catalogue details */}
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("Taarifa za katalogi", "Catalogue details")}
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Jina (English)", "Name (English)")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!canWrite}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Jina la Kiswahili", "Swahili name")}</Label>
                <Input
                  value={swName}
                  onChange={(e) => setSwName(e.target.value)}
                  readOnly={!canWrite}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Kategoria", "Category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as ProductCategory)}
                  disabled={!canWrite}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Kipimo", "Unit")}</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Maelezo ya ubadilishaji", "Conversion note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} readOnly={!canWrite} />
            </div>
            {producible && (
              <div className="grid gap-1.5">
                <Label>{t("Mavuno % (hiari)", "Default yield % (optional)")}</Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  value={yieldPct}
                  onChange={(e) => setYieldPct(e.target.value === "" ? "" : Number(e.target.value))}
                  readOnly={!canWrite}
                  placeholder="9.5"
                />
                <div className="text-[11px] text-muted-foreground">
                  {t(
                    "Ukijaza hii, Uzalishaji utakokotoa toleo na hasara moja kwa moja kutoka lita za maziwa ghafi.",
                    "If set, Production will compute output and wastage automatically from raw milk litres.",
                  )}
                </div>
              </div>
            )}
            {canWrite && (
              <Button
                onClick={saveDetails}
                disabled={update.isPending}
                className="w-fit text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {update.isPending
                  ? t("Inahifadhi…", "Saving…")
                  : t("Hifadhi taarifa", "Save details")}
              </Button>
            )}
          </div>
        </div>

        {/* Price matrix for this item */}
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("Bei (TZS)", "Price matrix (TZS)")}
          </div>
          <div className="grid gap-2">
            {TIERS.map((tier) => (
              <div key={tier} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  {tier === "own"
                    ? t("Chombo cha mteja", "Own container")
                    : tier === "bottle"
                      ? t("Pamoja na chupa", "With bottle")
                      : t("Jumla / dozeni", "Bulk / dozen")}
                </div>
                <Input
                  type="number"
                  step="any"
                  value={priceOf(tier)}
                  onChange={(e) => setTierEdits((x) => ({ ...x, [tier]: Number(e.target.value) }))}
                  readOnly={!canPrice}
                  className="h-9 w-32 text-right font-num"
                />
              </div>
            ))}
            {canPrice && (
              <Button
                onClick={savePrices}
                disabled={setPriceMut.isPending}
                variant="outline"
                className="w-fit"
              >
                {setPriceMut.isPending
                  ? t("Inahifadhi…", "Saving…")
                  : t("Hifadhi bei", "Save prices")}
              </Button>
            )}
            <div className="text-[11px] text-muted-foreground">
              {t(
                "Kila badiliko huhifadhiwa kwenye historia ya bei.",
                "Every change is kept in the price history.",
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
