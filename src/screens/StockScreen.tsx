import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/stock (was @/mock/data).
import {
  useStock,
  useStockMovements,
  useItemMovements,
  useStockMove,
  useRecordSpoilage,
  useSetReorder,
  useCreateStockItem,
  useUpdateStockItem,
  useSetStockItemActive,
  useDeleteStockItem,
} from "@/lib/data/hooks/stock";
import { usePackSizes, useCreatePackSize, useDeletePackSize } from "@/lib/data/hooks/packSizes";
import { todayISO } from "@/lib/data/dates";
import type { StockItem } from "@/mock/types";
import type { StockMovement } from "@/lib/data/stock";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { num } from "@/lib/format";
import {
  AlertTriangle,
  PackagePlus,
  Pencil,
  Plus,
  Boxes,
  Truck,
  Factory,
  Ban,
  Trash2,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Unit } from "@/mock/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";

function statusOf(s: { onHand: number; reorder: number }) {
  if (s.onHand <= 0) return "danger" as const;
  if (s.onHand < s.reorder) return "warning" as const;
  return "success" as const;
}

const KIND_LABEL: Record<string, { sw: string; en: string }> = {
  received: { sw: "Pokea", en: "Receive" },
  issued: { sw: "Toa", en: "Issue" },
  adjusted: { sw: "Rekebisha", en: "Adjust" },
  spoilt: { sw: "Uharibifu", en: "Spoilage" },
  produced: { sw: "Uzalishaji", en: "Produced" },
  collected: { sw: "Ukusanyaji", en: "Collected" },
  separated: { sw: "Kutenganisha", en: "Separated" },
  returned: { sw: "Marejesho", en: "Return" },
  "sold-cash": { sw: "Mauzo", en: "Sale" },
  "sold-credit": { sw: "Mauzo (mkopo)", en: "Sale (credit)" },
  "transfer-in": { sw: "Hamisho ndani", en: "Transfer in" },
  "transfer-out": { sw: "Hamisho nje", en: "Transfer out" },
};

function movementTone(m: StockMovement) {
  if (m.kind === "spoilt") return "danger" as const;
  if (m.qty > 0) return "success" as const;
  return "warning" as const;
}

export function StockScreen() {
  const { t, can } = useApp();
  const writable = can("stock:write");
  const { data: items = [], isPending, isError, refetch } = useStock();
  const MOVEMENTS_PAGE_SIZE = 50;
  const [movementsPage, setMovementsPage] = useState(0);
  const { data: movements = [] } = useStockMovements(movementsPage, MOVEMENTS_PAGE_SIZE);
  const setReorderMut = useSetReorder();
  const [tab, setTab] = useState<"finished" | "consumable" | "raw" | "movements">("finished");
  const [viewingId, setViewingId] = useState<string | null>(null);

  const lowCount = items.filter((s) => s.onHand < s.reorder && s.onHand > 0).length;
  const outCount = items.filter((s) => s.onHand <= 0).length;

  const filteredTab = useMemo(() => {
    if (tab === "movements") return [];
    return items.filter((s) => s.category === tab);
  }, [tab, items]);

  const itemName = (id: string | null) => items.find((x) => x.id === id)?.name ?? id ?? "";

  const rawItems = items.filter((s) => s.category === "raw");

  if (isPending) {
    return (
      <AppShell title={t("Ghala na Stock", "Stock & store")}>
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
      <AppShell title={t("Ghala na Stock", "Stock & store")}>
        <EmptyState
          icon={Boxes}
          title={t("Imeshindikana kupakia stock", "Could not load stock")}
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
    <AppShell title={t("Ghala na Stock", "Stock & store")}>
      {lowCount + outCount > 0 && (
        <div className="mb-5 rounded-2xl border border-[#E11B22]/30 bg-[#E11B22]/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[#E11B22]" />
          <div className="flex-1">
            <div className="font-semibold">
              {outCount} {t("nje ya stock", "out of stock")} · {lowCount}{" "}
              {t("chini ya kiwango", "low")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t(
                "Tafadhali wasiliana na ghala kwa kuagiza tena",
                "Please coordinate restocking with the store keeper",
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="border-[#E11B22] text-[#E11B22] hover:bg-[#E11B22]/10"
            onClick={() => setTab(outCount > 0 ? "finished" : "consumable")}
          >
            {t("Tazama orodha", "View list")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("SKUs zote", "Total SKUs")} value={items.length} accent="green" />
        <StatCard
          label={t("Bidhaa za kumaliza", "Finished SKUs")}
          value={items.filter((s) => s.category === "finished").length}
          accent="info"
        />
        <StatCard
          label={t("Vifaa ghala", "Consumables")}
          value={items.filter((s) => s.category === "consumable").length}
          accent="amber"
        />
        <StatCard
          label={t("Arifa za stock", "Low alerts")}
          value={lowCount + outCount}
          accent="red"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="finished">{t("Bidhaa kumaliza", "Finished products")}</TabsTrigger>
          <TabsTrigger value="consumable">{t("Vifaa ghala", "Consumables store")}</TabsTrigger>
          <TabsTrigger value="raw">{t("Maziwa ghafi", "Raw stock")}</TabsTrigger>
          <TabsTrigger value="movements">{t("Harakati", "Stock movements")}</TabsTrigger>
        </TabsList>

        {(["finished", "consumable"] as const).map((thisTab) => (
          <TabsContent key={thisTab} value={thisTab} className="mt-4">
            <SectionCard
              title={
                thisTab === "finished"
                  ? t("Bidhaa za kumaliza", "Finished products")
                  : t("Vifaa vya ghala", "Consumables (Ghala)")
              }
              action={
                <div className="flex gap-2">
                  <ExportMenu
                    formats={["csv", "excel", "pdf"]}
                    filename={`stock-${thisTab}`}
                    data={() => ({
                      title: t("Stock", "Stock"),
                      headers: ["Item", "Swahili", "On hand", "Unit", "Reorder", "Status"],
                      rows: items
                        .filter((s) => s.category === thisTab)
                        .map((s) => [
                          s.name,
                          s.swName ?? "",
                          s.onHand,
                          s.unit,
                          s.reorder,
                          s.onHand <= 0 ? "out" : s.onHand < s.reorder ? "low" : "ok",
                        ]),
                    })}
                  />
                  {writable && <AdjustDialog items={items.filter((s) => s.category === thisTab)} />}
                  {writable && (
                    <ReceiveDialog items={items.filter((s) => s.category === thisTab)} />
                  )}
                  {writable && thisTab === "consumable" && (
                    <StoreItemDialog category="consumable" />
                  )}
                </div>
              }
            >
              {filteredTab.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title={t("Hakuna bidhaa hapa bado", "No items here yet")}
                />
              ) : (
                <table className="w-full text-sm table-zebra">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Bidhaa", "Item")}</th>
                      <th className="text-right px-3">{t("Inayopatikana", "On hand")}</th>
                      <th className="text-right px-3">{t("Kiwango cha chini", "Reorder")}</th>
                      <th className="px-3">{t("Hali", "Status")}</th>
                      <th className="px-3">{t("Harakati", "Last move")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTab.map((s) => {
                      const tone = statusOf(s);
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer"
                          onClick={() => setViewingId(s.id)}
                        >
                          <td className="py-2.5 px-3 font-medium">
                            {s.name}
                            {s.swName && (
                              <span className="text-xs text-muted-foreground ml-1">
                                / {s.swName}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-num font-semibold">
                            {num(s.onHand)} {s.unit}
                          </td>
                          <td
                            className="py-2.5 px-3 text-right font-num text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {writable ? (
                              <Input
                                type="number"
                                step="any"
                                defaultValue={s.reorder}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val !== s.reorder) {
                                    setReorderMut.mutate(
                                      { id: s.id, name: s.name, reorder: val },
                                      {
                                        onSuccess: () =>
                                          toast.success(
                                            t("Kiwango kimebadilishwa", "Threshold updated"),
                                          ),
                                        onError: () =>
                                          toast.error(
                                            t("Imeshindikana kubadilisha", "Could not update"),
                                          ),
                                      },
                                    );
                                  }
                                }}
                                className="h-7 w-20 ml-auto text-right font-num text-xs"
                              />
                            ) : (
                              <>
                                {num(s.reorder)} {s.unit}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {s.active === false ? (
                              <Pill tone="slate">{t("Imesimamishwa", "Suspended")}</Pill>
                            ) : (
                              <Pill tone={tone}>
                                {tone === "danger"
                                  ? t("Imeisha", "Out")
                                  : tone === "warning"
                                    ? t("Chini", "Low")
                                    : "OK"}
                              </Pill>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {s.lastMovement}
                          </td>
                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {writable && thisTab === "consumable" && <ItemRowActions item={s} />}
                            {writable && thisTab === "finished" && <PackSizesDialog item={s} />}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setViewingId(s.id)}
                            >
                              {t("Tazama", "View")}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </SectionCard>
          </TabsContent>
        ))}

        <TabsContent value="raw" className="mt-4">
          <SectionCard
            title={t("Maziwa ghafi na malighafi", "Raw milk and intermediates")}
            action={
              writable && (
                <div className="flex gap-2">
                  <SendToProductionDialog rawItems={rawItems} />
                  <StoreItemDialog category="raw" />
                </div>
              )
            }
          >
            {rawItems.length === 0 ? (
              <EmptyState icon={Boxes} title={t("Hakuna malighafi bado", "No raw stock yet")} />
            ) : (
              <table className="w-full text-sm table-zebra">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Bidhaa", "Item")}</th>
                    <th className="text-right px-3">{t("Inayopatikana", "On hand")}</th>
                    <th className="text-right px-3">{t("Kiwango cha chini", "Reorder")}</th>
                    <th className="px-3">{t("Hali", "Status")}</th>
                    <th className="px-3">{t("Harakati", "Last move")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rawItems.map((s) => {
                    const tone = statusOf(s);
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">
                          {s.name}
                          {s.swName && (
                            <span className="text-xs text-muted-foreground ml-1">/ {s.swName}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-semibold">
                          {num(s.onHand)} {s.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-num text-muted-foreground">
                          {num(s.reorder)} {s.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.active === false ? (
                            <Pill tone="slate">{t("Imesimamishwa", "Suspended")}</Pill>
                          ) : (
                            <Pill tone={tone}>
                              {tone === "danger"
                                ? t("Imeisha", "Out")
                                : tone === "warning"
                                  ? t("Chini", "Low")
                                  : "OK"}
                            </Pill>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {s.lastMovement}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {writable && <PackSizesDialog item={s} />}
                          {writable && <ItemRowActions item={s} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <SectionCard
            title={t("Daftari la harakati za stock", "Stock movements log")}
            action={
              <ExportMenu
                formats={["csv", "excel", "pdf"]}
                filename={`stock-movements-${todayISO()}`}
                data={() => ({
                  title: t("Harakati za stock", "Stock movements"),
                  headers: ["Date", "Item", "Kind", "Qty", "Unit", "Reason", "By"],
                  rows: movements.map((m) => [
                    m.date,
                    itemName(m.stockItemId),
                    m.kind,
                    m.qty,
                    m.unit,
                    m.reason ?? "",
                    m.byName ?? "",
                  ]),
                })}
              />
            }
          >
            {movements.length === 0 ? (
              <EmptyState title={t("Hakuna harakati bado", "No movements yet")} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Wakati", "Time")}</th>
                    <th>{t("Bidhaa", "Item")}</th>
                    <th>{t("Aina", "Type")}</th>
                    <th className="text-right">{t("Mabadiliko", "Δ")}</th>
                    <th>{t("Sababu", "Reason")}</th>
                    <th>{t("Aliyefanya", "By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {m.date}
                      </td>
                      <td className="py-2.5 font-medium">{itemName(m.stockItemId)}</td>
                      <td className="py-2.5">
                        <Pill tone={movementTone(m)}>
                          {t(KIND_LABEL[m.kind]?.sw ?? m.kind, KIND_LABEL[m.kind]?.en ?? m.kind)}
                        </Pill>
                      </td>
                      <td className="py-2.5 text-right font-num font-semibold">
                        {m.qty > 0 ? "+" : ""}
                        {num(m.qty)} {m.unit}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{m.reason ?? "·"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{m.byName ?? "·"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(movementsPage > 0 || movements.length === MOVEMENTS_PAGE_SIZE) && (
              <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {t(`Ukurasa ${movementsPage + 1}`, `Page ${movementsPage + 1}`)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={movementsPage === 0}
                    onClick={() => setMovementsPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={movements.length < MOVEMENTS_PAGE_SIZE}
                    onClick={() => setMovementsPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {viewingId && (
        <StockItemDrawer
          item={items.find((x) => x.id === viewingId)!}
          onClose={() => setViewingId(null)}
          writable={writable}
        />
      )}
    </AppShell>
  );
}

/** Add or edit a raw / consumable store item. */
function StoreItemDialog({ category, item }: { category: "raw" | "consumable"; item?: StockItem }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [swName, setSwName] = useState(item?.swName ?? "");
  const [unit, setUnit] = useState<Unit>(item?.unit ?? (category === "raw" ? "L" : "pcs"));
  const [reorder, setReorder] = useState(item?.reorder ?? 0);
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const busy = create.isPending || update.isPending;

  const save = () => {
    if (!name.trim()) {
      toast.error(t("Jaza jina la bidhaa", "Fill in the item name"));
      return;
    }
    const done = {
      onSuccess: () => {
        toast.success(
          item ? t("Bidhaa imehifadhiwa", "Item saved") : t("Bidhaa imeongezwa", "Item added"),
        );
        setOpen(false);
      },
      onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save the item")),
    };
    if (item) {
      update.mutate(
        { id: item.id, name: name.trim(), swName: swName.trim() || undefined, unit, reorder },
        done,
      );
    } else {
      create.mutate(
        { name: name.trim(), swName: swName.trim() || undefined, category, unit, reorder },
        done,
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(item?.name ?? "");
          setSwName(item?.swName ?? "");
          setUnit(item?.unit ?? (category === "raw" ? "L" : "pcs"));
          setReorder(item?.reorder ?? 0);
        }
      }}
    >
      <DialogTrigger asChild>
        {item ? (
          <Button size="icon" variant="ghost" className="h-7 w-7" title={t("Hariri", "Edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {category === "raw"
              ? t("Ongeza malighafi", "Add raw item")
              : t("Ongeza kifaa", "Add item")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item
              ? `${t("Hariri bidhaa", "Edit item")}: ${item.name}`
              : category === "raw"
                ? t("Ongeza malighafi", "Add a raw stock item")
                : t("Ongeza kifaa cha ghala", "Add a consumable store item")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina (Kiingereza)", "Name (English)")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Jina (Kiswahili, hiari)", "Name (Swahili, optional)")}</Label>
            <Input value={swName} onChange={(e) => setSwName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kipimo", "Unit")}</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
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
            <div className="grid gap-1.5">
              <Label>{t("Kiwango cha chini (reorder)", "Reorder level")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={reorder}
                onChange={(e) => setReorder(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
            {t(
              "Idadi inayopatikana inabadilika kupitia kupokea, kutoa na kurekebisha; haiandikwi moja kwa moja.",
              "On-hand changes only through receive, issue and adjust movements; it is never typed directly.",
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Configures the container/pack sizes this item is counted by in Morning
 *  Count (e.g. Mtindi's own cup/bottle sizes, distinct from raw milk's
 *  ndoo/galoni/chupa). An item with nothing configured here just gets a
 *  plain single-number count instead, that's the default for everything. */
function PackSizesDialog({ item }: { item: StockItem }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const { data: allSizes = [] } = usePackSizes();
  const create = useCreatePackSize();
  const remove = useDeletePackSize();
  const sizes = allSizes.filter((p) => p.stockItemId === item.id);

  const add = () => {
    if (!label.trim() || !qty || Number(qty) <= 0) return;
    create.mutate(
      { stockItemId: item.id, label: label.trim(), qtyPerPack: Number(qty) },
      {
        onSuccess: () => {
          setLabel("");
          setQty("");
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add the size")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          title={t("Vipimo vya kuhesabu", "Count pack sizes")}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Vipimo vya kuhesabu", "Pack sizes for counting")}: {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "Ukiweka vipimo hapa, Hesabu ya asubuhi itauliza idadi ya kila kimoja badala ya jumla moja.",
              "Once sizes are set here, Morning Count asks for a count of each one instead of a single total.",
            )}
          </p>
          {sizes.length === 0 ? (
            <EmptyState
              title={t("Bado hakuna vipimo", "No sizes yet")}
              description={t(
                `${item.name} itahesabiwa kwa namba moja mpaka uongeze vipimo.`,
                `${item.name} is counted as one plain number until you add sizes.`,
              )}
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {sizes.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {p.label}{" "}
                    <span className="text-xs text-muted-foreground font-num">
                      ({num(p.qtyPerPack)} {item.unit})
                    </span>
                  </span>
                  <button
                    onClick={() => remove.mutate({ id: p.id, label: p.label })}
                    className="text-muted-foreground hover:text-[#E11B22]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">{t("Jina la kipimo", "Size label")}</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("mf. Chupa 500ml", "e.g. 500ml bottle")}
              />
            </div>
            <div className="grid gap-1 w-28">
              <Label className="text-xs">
                {t("Kiasi", "Qty")} ({item.unit})
              </Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                className="font-num"
              />
            </div>
            <Button
              variant="outline"
              disabled={create.isPending || !label.trim() || !qty || Number(qty) <= 0}
              onClick={add}
            >
              {t("Ongeza", "Add")}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Funga", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit + suspend controls for a raw / consumable item row. */
function ItemRowActions({ item }: { item: StockItem }) {
  const { t } = useApp();
  const setActive = useSetStockItemActive();
  const deleteItem = useDeleteStockItem();
  if (item.category === "finished") return null;
  return (
    <>
      <StoreItemDialog category={item.category} item={item} />
      <ConfirmDialog
        title={
          item.active === false
            ? t("Rudisha bidhaa hii?", "Reactivate this item?")
            : t("Simamisha bidhaa hii?", "Suspend this item?")
        }
        description={
          item.active === false
            ? t("Itaonekana tena kwenye fomu za stock.", "It will appear in stock forms again.")
            : t(
                "Itafichwa kwenye fomu; historia yake inabaki kamili.",
                "It is hidden from forms; its history stays intact.",
              )
        }
        confirmLabel={
          item.active === false ? t("Rudisha", "Reactivate") : t("Simamisha", "Suspend")
        }
        onConfirm={() =>
          setActive.mutate(
            { id: item.id, name: item.name, active: item.active === false },
            {
              onSuccess: () =>
                toast.success(
                  item.active === false
                    ? t("Bidhaa imerudishwa", "Item reactivated")
                    : t("Bidhaa imesimamishwa", "Item suspended"),
                ),
              onError: () => toast.error(t("Imeshindikana", "Could not update the item")),
            },
          )
        }
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 ${item.active === false ? "text-[#1E7C3F]" : "text-muted-foreground"}`}
            title={item.active === false ? t("Rudisha", "Reactivate") : t("Simamisha", "Suspend")}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <ConfirmDialog
        destructive
        title={t("Futa bidhaa ghalani?", "Delete this store item?")}
        description={t(
          "Itaondolewa kwenye maghala na fomu za harakati, historia yake ya harakati itabaki salama. Unaweza kuirudisha kutoka Mipangilio > Tupio.",
          "It will be removed from stock lists and movement forms, its movement history stays intact. You can restore it from Settings > Trash.",
        )}
        confirmLabel={t("Futa", "Delete")}
        onConfirm={() =>
          deleteItem.mutate(
            { id: item.id, name: item.name },
            {
              onSuccess: () => toast.success(t("Bidhaa imefutwa", "Item deleted")),
              onError: () => toast.error(t("Imeshindikana kufuta", "Could not delete the item")),
            },
          )
        }
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-[#E11B22]"
            title={t("Futa", "Delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
    </>
  );
}

function ReceiveDialog({ items: allItems }: { items: StockItem[] }) {
  const { t } = useApp();
  const items = allItems.filter((i) => i.active !== false);
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id);
  const [qty, setQty] = useState(50);
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState(25000);
  const [batch, setBatch] = useState(`B-${Date.now().toString().slice(-4)}`);
  const move = useStockMove();

  const save = () => {
    if (!itemId || qty <= 0) return;
    move.mutate(
      {
        stockItemId: itemId,
        kind: "received",
        qty,
        reason: supplier ? `${supplier} · ${batch} · TZS ${cost}` : batch,
        ref: batch,
      },
      {
        onSuccess: () => {
          toast.success(t("Imepokelewa", "Received"));
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kupokea", "Could not record receipt")),
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
          <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
          {t("Pokea ununuzi", "Receive purchase")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Pokea bidhaa ghalani", "Receive items to store")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Bidhaa", "Item")}</Label>
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
          <div className="grid grid-cols-2 gap-3">
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
              <Label>{t("Batch", "Batch / lot")}</Label>
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Mzabuni", "Supplier")}</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Kibo Plastics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Gharama (TZS)", "Cost (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={move.isPending}>
            {move.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ items: allItems }: { items: StockItem[] }) {
  const { t } = useApp();
  const items = allItems.filter((i) => i.active !== false);
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id);
  const [delta, setDelta] = useState(-1);
  const [reason, setReason] = useState("");
  // Explicit type: no guessing from the reason text.
  const [kind, setKind] = useState<"adjusted" | "spoilt">("adjusted");
  const move = useStockMove();
  const spoil = useRecordSpoilage();
  const pending = move.isPending || spoil.isPending;

  const save = () => {
    if (!itemId || delta === 0) return;
    const done = {
      onSuccess: () => {
        toast.success(t("Imefanyiwa marekebisho", "Adjustment recorded"));
        setOpen(false);
        setReason("");
      },
      onError: () => toast.error(t("Imeshindikana kurekodi", "Could not record adjustment")),
    };
    if (kind === "spoilt") {
      spoil.mutate(
        { stockItemId: itemId, qty: Math.abs(delta), reason: reason || undefined },
        done,
      );
    } else {
      move.mutate(
        { stockItemId: itemId, kind: "adjusted", qty: delta, reason: reason || undefined },
        done,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          {t("Marekebisho / spoilage", "Adjust / spoilage")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Marekebisho ya stock", "Stock adjustment")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Bidhaa", "Item")}</Label>
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
            <Label>{t("Aina", "Type")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjusted">
                  {t("Marekebisho ya hesabu", "Count adjustment")}
                </SelectItem>
                <SelectItem value="spoilt">{t("Uharibifu", "Spoilage")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>
              {kind === "spoilt"
                ? t("Idadi iliyoharibika", "Quantity spoilt")
                : t(
                    "Mabadiliko (chanya kuongeza, hasi kupunguza)",
                    "Delta (positive to add, negative to remove)",
                  )}
            </Label>
            <Input
              type="number"
              step="any"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Sababu", "Reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "Mfano: imeharibika, kosa la kuhesabu, marejesho",
                "e.g. spoilage, count correction, return",
              )}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendToProductionDialog({ rawItems: allRaw }: { rawItems: StockItem[] }) {
  const { t } = useApp();
  const rawItems = allRaw.filter((i) => i.active !== false);
  const [open, setOpen] = useState(false);
  const [litres, setLitres] = useState(60);
  const move = useStockMove();
  const rawMilkId = rawItems.find((s) => s.id === "raw-milk")?.id ?? rawItems[0]?.id;

  const save = () => {
    if (!rawMilkId || litres <= 0) return;
    move.mutate(
      {
        stockItemId: rawMilkId,
        kind: "issued",
        qty: litres,
        reason: t("Kwenda uzalishaji", "To production line"),
      },
      {
        onSuccess: () => {
          toast.success(t("Imepelekwa", "Sent"));
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kutuma", "Could not send")),
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
          <Factory className="h-3.5 w-3.5 mr-1.5" />
          {t("Peleka uzalishaji", "Send to production")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Peleka maziwa ghafi uzalishaji", "Send raw milk to production")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Litre", "Litres")}</Label>
            <Input
              type="number"
              step="any"
              value={litres}
              onChange={(e) => setLitres(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={move.isPending}>
            {move.isPending ? t("Inatuma…", "Sending…") : t("Tuma", "Send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockItemDrawer({
  item,
  onClose,
  writable,
}: {
  item: StockItem;
  onClose: () => void;
  writable: boolean;
}) {
  const { t } = useApp();
  const tone = statusOf(item);
  const { data: movements = [] } = useItemMovements(item.id);
  const move = useStockMove();

  const quick = (kind: "received" | "issued", qty: number, okMsg: string) =>
    move.mutate(
      { stockItemId: item.id, kind, qty },
      {
        onSuccess: () => toast.success(okMsg),
        onError: () => toast.error(t("Imeshindikana", "Could not record")),
      },
    );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <div>{item.name}</div>
              <div className="text-xs text-muted-foreground font-normal capitalize">
                {item.category} · {item.unit}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Inayopatikana", "On hand")}
            </div>
            <div className="font-num font-bold">
              {num(item.onHand)} {item.unit}
            </div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Kiwango cha chini", "Reorder")}
            </div>
            <div className="font-num font-bold">
              {num(item.reorder)} {item.unit}
            </div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Hali", "Status")}
            </div>
            <div>
              <Pill tone={tone}>
                {tone === "danger"
                  ? t("Imeisha", "Out")
                  : tone === "warning"
                    ? t("Chini", "Low")
                    : "OK"}
              </Pill>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-xs font-semibold mb-2">
            {t("Harakati za hivi karibuni", "Recent movements")}
          </div>
          {movements.length === 0 ? (
            <EmptyState title={t("Hakuna harakati bado", "No movements yet")} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">
                      {t(KIND_LABEL[m.kind]?.sw ?? m.kind, KIND_LABEL[m.kind]?.en ?? m.kind)}{" "}
                      <span className="text-xs text-muted-foreground">· {m.byName ?? "·"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.date}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </div>
                  </div>
                  <div
                    className={`font-num font-semibold ${m.qty < 0 ? "text-[#E11B22]" : "text-[#1E7C3F]"}`}
                  >
                    {m.qty > 0 ? "+" : ""}
                    {num(m.qty)} {m.unit}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {writable && (
          <div className="mt-5 flex gap-2">
            <Button
              className="flex-1 text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
              disabled={move.isPending}
              onClick={() => quick("received", 1, t("Imepokelewa", "Received"))}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("Pokea +1", "Receive +1")}
            </Button>
            <Button
              variant="outline"
              disabled={move.isPending}
              onClick={() => quick("issued", 1, t("Imetolewa", "Issued"))}
            >
              <Truck className="h-3.5 w-3.5 mr-1.5" />
              {t("Toa -1", "Issue -1")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
