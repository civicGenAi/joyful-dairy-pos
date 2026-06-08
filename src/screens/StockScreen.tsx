import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { STOCK, TODAY } from "@/mock/data";
import type { StockItem } from "@/mock/types";
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
import { AlertTriangle, PackagePlus, Pencil, Plus, Boxes, Truck, Factory } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";

interface Movement {
  id: string;
  time: string;
  itemId: string;
  itemName: string;
  kind: "Receive" | "Issue" | "Sale" | "Adjust" | "Spoilage";
  delta: number;
  unit: string;
  by: string;
  reason?: string;
}

const MOVEMENT_SEED: Movement[] = [
  {
    id: "m1",
    time: "08:12",
    itemId: "s-fresh",
    itemName: "Fresh milk",
    kind: "Receive",
    delta: 220,
    unit: "L",
    by: "Joyce",
  },
  {
    id: "m2",
    time: "09:30",
    itemId: "s-mozz",
    itemName: "Mozzarella",
    kind: "Issue",
    delta: -3,
    unit: "kg",
    by: "Neema",
    reason: "POS sale",
  },
  {
    id: "m3",
    time: "10:05",
    itemId: "c-vik-r",
    itemName: "Vikopo robo",
    kind: "Issue",
    delta: -60,
    unit: "pcs",
    by: "Mama Esther",
    reason: "Production",
  },
  {
    id: "m4",
    time: "10:42",
    itemId: "s-butter",
    itemName: "Butter 250g",
    kind: "Sale",
    delta: -12,
    unit: "pcs",
    by: "POS",
  },
  {
    id: "m5",
    time: "12:18",
    itemId: "s-hall",
    itemName: "Halloumi",
    kind: "Receive",
    delta: 6.35,
    unit: "kg",
    by: "Production",
  },
  {
    id: "m6",
    time: "13:50",
    itemId: "c-mad5",
    itemName: "Madumu 5L",
    kind: "Issue",
    delta: -4,
    unit: "pcs",
    by: "Route",
  },
  {
    id: "m7",
    time: "14:20",
    itemId: "s-cream",
    itemName: "Cream",
    kind: "Spoilage",
    delta: -2,
    unit: "L",
    by: "Production",
    reason: "Quality fail",
  },
];

function statusOf(s: { onHand: number; reorder: number }) {
  if (s.onHand <= 0) return "danger" as const;
  if (s.onHand < s.reorder) return "warning" as const;
  return "success" as const;
}

export function StockScreen() {
  const { t, can } = useApp();
  const writable = can("stock:write");
  const [items, setItems] = useState<StockItem[]>(STOCK);
  const [tab, setTab] = useState<"finished" | "consumable" | "raw" | "movements">("finished");
  const [movements, setMovements] = useState<Movement[]>(MOVEMENT_SEED);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const lowCount = items.filter((s) => s.onHand < s.reorder && s.onHand > 0).length;
  const outCount = items.filter((s) => s.onHand <= 0).length;

  const filteredTab = useMemo(() => {
    if (tab === "movements") return [];
    return items.filter((s) => s.category === tab);
  }, [tab, items]);

  const addMovement = (m: Omit<Movement, "id" | "time">) => {
    const mv: Movement = {
      ...m,
      id: `m-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMovements((xs) => [mv, ...xs]);
    setItems((xs) =>
      xs.map((x) =>
        x.id === m.itemId
          ? {
              ...x,
              onHand: Math.max(0, x.onHand + m.delta),
              lastMovement: t("Sasa hivi", "Just now"),
            }
          : x,
      ),
    );
  };

  const setReorder = (id: string, val: number) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, reorder: val } : x)));

  // Raw category may be empty in the seed; show a couple of mock raw rows so the tab is alive.
  const rawItems: StockItem[] = items.filter((s) => s.category === "raw").length
    ? items.filter((s) => s.category === "raw")
    : [
        {
          id: "raw-milk",
          name: "Raw milk",
          category: "raw",
          unit: "L",
          onHand: 284,
          reorder: 100,
          lastMovement: t("Mwagiko leo asubuhi", "Field intake this morning"),
        },
        {
          id: "raw-cream",
          name: "Cream",
          category: "raw",
          unit: "L",
          onHand: 18,
          reorder: 10,
          lastMovement: t("Imetenganishwa leo", "Separated today"),
        },
        {
          id: "raw-curd",
          name: "Curd for cheese",
          category: "raw",
          unit: "kg",
          onHand: 32,
          reorder: 15,
          lastMovement: t("Imepika asubuhi", "Made this morning"),
        },
      ];

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
                  <ExportMenu formats={["csv", "excel"]} filename={`stock-${thisTab}`} />
                  {writable && (
                    <AdjustDialog
                      items={items.filter((s) => s.category === thisTab)}
                      onAdjust={addMovement}
                    />
                  )}
                  {writable && (
                    <ReceiveDialog
                      items={items.filter((s) => s.category === thisTab)}
                      onReceive={addMovement}
                    />
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
                                value={s.reorder}
                                onChange={(e) => setReorder(s.id, Number(e.target.value))}
                                className="h-7 w-20 ml-auto text-right font-num text-xs"
                              />
                            ) : (
                              <>
                                {num(s.reorder)} {s.unit}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Pill tone={tone}>
                              {tone === "danger"
                                ? t("Imeisha", "Out")
                                : tone === "warning"
                                  ? t("Chini", "Low")
                                  : "OK"}
                            </Pill>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {s.lastMovement}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
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
            action={writable && <SendToProductionDialog onAct={addMovement} />}
          >
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Bidhaa", "Item")}</th>
                  <th className="text-right px-3">{t("Inayopatikana", "On hand")}</th>
                  <th className="text-right px-3">{t("Kiwango cha chini", "Reorder")}</th>
                  <th className="px-3">{t("Hali", "Status")}</th>
                  <th className="px-3">{t("Harakati", "Last move")}</th>
                </tr>
              </thead>
              <tbody>
                {rawItems.map((s) => {
                  const tone = statusOf(s);
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3 text-right font-num font-semibold">
                        {num(s.onHand)} {s.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-num text-muted-foreground">
                        {num(s.reorder)} {s.unit}
                      </td>
                      <td className="py-2.5 px-3">
                        <Pill tone={tone}>
                          {tone === "danger"
                            ? t("Imeisha", "Out")
                            : tone === "warning"
                              ? t("Chini", "Low")
                              : "OK"}
                        </Pill>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">
                        {s.lastMovement}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <SectionCard
            title={t("Daftari la harakati za stock", "Stock movements log")}
            action={<ExportMenu formats={["csv"]} filename={`stock-movements-${TODAY}`} />}
          >
            {movements.length === 0 ? (
              <EmptyState title={t("Hakuna harakati leo", "No movements today")} />
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
                        {m.time}
                      </td>
                      <td className="py-2.5 font-medium">{m.itemName}</td>
                      <td className="py-2.5">
                        <Pill
                          tone={
                            m.kind === "Receive"
                              ? "success"
                              : m.kind === "Spoilage"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {m.kind}
                        </Pill>
                      </td>
                      <td className="py-2.5 text-right font-num font-semibold">
                        {m.delta > 0 ? "+" : ""}
                        {num(m.delta)} {m.unit}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{m.reason ?? "—"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{m.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {viewingId && (
        <StockItemDrawer
          item={items.find((x) => x.id === viewingId)!}
          movements={movements.filter((m) => m.itemId === viewingId)}
          onClose={() => setViewingId(null)}
          onAdjust={addMovement}
          writable={writable}
        />
      )}
    </AppShell>
  );
}

function ReceiveDialog({
  items,
  onReceive,
}: {
  items: StockItem[];
  onReceive: (m: Omit<Movement, "id" | "time">) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id);
  const [qty, setQty] = useState(50);
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState(25000);
  const [batch, setBatch] = useState(`B-${Date.now().toString().slice(-4)}`);

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
              <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
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
              <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              const it = items.find((s) => s.id === itemId)!;
              onReceive({
                itemId: itemId!,
                itemName: it.name,
                kind: "Receive",
                delta: qty,
                unit: it.unit,
                by: "Store",
                reason: supplier ? `${supplier} · ${batch}` : batch,
              });
              toast.success(t("Imepokelewa", "Received"));
              setOpen(false);
            }}
          >
            {t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  items,
  onAdjust,
}: {
  items: StockItem[];
  onAdjust: (m: Omit<Movement, "id" | "time">) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id);
  const [delta, setDelta] = useState(-1);
  const [reason, setReason] = useState("");

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
            <Label>
              {t(
                "Mabadiliko (chanya kuongeza, hasi kupunguza)",
                "Delta (positive to add, negative to remove)",
              )}
            </Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
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
          <Button
            onClick={() => {
              const it = items.find((s) => s.id === itemId)!;
              onAdjust({
                itemId: itemId!,
                itemName: it.name,
                kind:
                  delta < 0 && reason.toLowerCase().includes("haribika") ? "Spoilage" : "Adjust",
                delta,
                unit: it.unit,
                by: "Store",
                reason: reason || undefined,
              });
              toast.success(t("Imefanyiwa marekebisho", "Adjustment recorded"));
              setOpen(false);
            }}
          >
            {t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendToProductionDialog({ onAct }: { onAct: (m: Omit<Movement, "id" | "time">) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [litres, setLitres] = useState(60);
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
              value={litres}
              onChange={(e) => setLitres(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              onAct({
                itemId: "raw-milk",
                itemName: "Raw milk",
                kind: "Issue",
                delta: -litres,
                unit: "L",
                by: "Production",
                reason: "To production line",
              });
              toast.success(t("Imepelekwa", "Sent"));
              setOpen(false);
            }}
          >
            {t("Tuma", "Send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockItemDrawer({
  item,
  movements,
  onClose,
  onAdjust,
  writable,
}: {
  item: StockItem;
  movements: Movement[];
  onClose: () => void;
  onAdjust: (m: Omit<Movement, "id" | "time">) => void;
  writable: boolean;
}) {
  const { t } = useApp();
  const tone = statusOf(item);
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
            <EmptyState title={t("Hakuna harakati leo", "No movements today")} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">
                      {m.kind} <span className="text-xs text-muted-foreground">· {m.by}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.time}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </div>
                  </div>
                  <div
                    className={`font-num font-semibold ${m.delta < 0 ? "text-[#E11B22]" : "text-[#1E7C3F]"}`}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {num(m.delta)} {m.unit}
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
              onClick={() => {
                onAdjust({
                  itemId: item.id,
                  itemName: item.name,
                  kind: "Receive",
                  delta: 1,
                  unit: item.unit,
                  by: "Store",
                });
                toast.success(t("Imepokelewa", "Received"));
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("Pokea +1", "Receive +1")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onAdjust({
                  itemId: item.id,
                  itemName: item.name,
                  kind: "Issue",
                  delta: -1,
                  unit: item.unit,
                  by: "Store",
                });
                toast.success(t("Imetolewa", "Issued"));
              }}
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
