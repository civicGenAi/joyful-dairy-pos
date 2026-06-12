import { useApp } from "@/app/context";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// BACKEND: data flows through src/lib/data/{products,customers,stock,sales,van}.
// The confirmed load persists server-side (van_loads), returns are computed
// from load minus sales, and cash deposits require the bank slip upload.
import { useProducts, usePriceMatrix } from "@/lib/data/hooks/products";
import { useCustomers } from "@/lib/data/hooks/customers";
import { useStock } from "@/lib/data/hooks/stock";
import { useSalesByDate, useCompleteSale } from "@/lib/data/hooks/sales";
import { useRecordTransfer } from "@/lib/data/hooks/collections";
import { useRecordReturn } from "@/lib/data/hooks/stock";
import { useVanLoads, useSaveVanLoad } from "@/lib/data/hooks/van";
import { depositsRepo } from "@/lib/data/sales";
import { uploadHardCopy } from "@/lib/data/uploads";
import { todayISO } from "@/lib/data/dates";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tzs, num } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
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
  LayoutGrid,
  List,
  Pencil,
  Paperclip,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartLine {
  productId: string;
  qty: number;
}

/** Planning state per product before the load is confirmed. */
interface PlanLine {
  selected: boolean;
  qty: number;
}

const RETURN_REASONS = [
  { id: "damaged", sw: "Imeharibika", en: "Damaged" },
  { id: "spoilt", sw: "Imeharibika ubora", en: "Spoilt" },
  { id: "spillage", sw: "Imemwagika", en: "Spillage" },
  { id: "count-error", sw: "Kosa la kuhesabu", en: "Counting error" },
  { id: "other", sw: "Nyingine (andika)", en: "Other (type it)" },
] as const;

export function RouteScreen() {
  const { user, authReady, t, logout } = useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();
  const { data: products = [] } = useProducts();
  const { data: priceMatrix = {} } = usePriceMatrix();
  const { data: allCustomers = [] } = useCustomers();
  const customers = allCustomers.filter((c) => !c.suspended);
  const { data: stock = [] } = useStock();
  const { data: sales = [] } = useSalesByDate(today, "route");
  const { data: vanLoads = [] } = useVanLoads(today);
  const completeSaleMut = useCompleteSale();
  const recordTransfer = useRecordTransfer();
  const recordReturn = useRecordReturn();
  const saveVanLoad = useSaveVanLoad();

  const [tab, setTab] = useState("plan");
  const [online, setOnline] = useState(true);
  const [session, setSession] = useState<"morning" | "evening">("morning");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<string>("");
  const [customerQ, setCustomerQ] = useState("");
  const [payment, setPayment] = useState<"cash" | "credit" | "mpesa">("cash");
  // Driver-chosen layout for the product picker on the Sell tab.
  const [sellStyle, setSellStyle] = useLocalStorage<"grid" | "list">("ajd:van-sell-style", "grid");
  const [deposit, setDeposit] = useState(0);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  // The system proposes every sellable product; the driver unticks what is
  // not on the van and fills quantities for what is. Confirming persists only
  // the selected lines, the rest disappear to keep the day uncluttered.
  const [plan, setPlan] = useState<Record<string, PlanLine>>({});
  const loadConfirmed = vanLoads.length > 0;
  const sellable = useMemo(() => products.filter((p) => p.active !== false), [products]);
  useEffect(() => {
    if (loadConfirmed || sellable.length === 0) return;
    setPlan((prev) => {
      const next = { ...prev };
      for (const p of sellable) if (!next[p.id]) next[p.id] = { selected: true, qty: 0 };
      return next;
    });
  }, [sellable, loadConfirmed]);

  // After confirmation the load comes from the server, never client state.
  const load = useMemo(
    () => vanLoads.map((l) => ({ productId: l.productId, qty: l.qty })),
    [vanLoads],
  );

  // Driver overrides for returns; everything else is pure math (load - sold).
  const [returnEdit, setReturnEdit] = useState<
    Record<string, { qty: number; reason: string; custom: string }>
  >({});
  const [editingReturn, setEditingReturn] = useState<string | null>(null);
  const [returnsSaved, setReturnsSaved] = useState(false);

  const priceOf = (pid: string) => priceMatrix[pid]?.own ?? 0;
  const productOf = (pid: string) => products.find((p) => p.id === pid);
  const stockItemOf = (pid: string) =>
    stock.find((s) => s.productId === pid && s.category === "finished");

  const cartTotal = cart.reduce((a, l) => a + priceOf(l.productId) * l.qty, 0);
  const loadedValue = load.reduce((a, l) => a + priceOf(l.productId) * l.qty, 0);

  // Derived cash-up from actual route sales.
  const cashTotal = sales.filter((s) => s.payment === "cash").reduce((a, s) => a + s.totalTZS, 0);
  const creditTotal = sales
    .filter((s) => s.payment === "credit")
    .reduce((a, s) => a + s.totalTZS, 0);
  const mpesaTotal = sales.filter((s) => s.payment === "mpesa").reduce((a, s) => a + s.totalTZS, 0);
  const expectedDeposit = cashTotal + mpesaTotal;

  // Per-product sold quantities from server sales.
  const soldByProduct: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales)
      for (const l of s.lines ?? []) m[l.productId] = (m[l.productId] ?? 0) + l.qty;
    return m;
  }, [sales]);

  const remainingOf = (pid: string, loadedQty: number) =>
    Math.max(0, loadedQty - (soldByProduct[pid] ?? 0));
  /** What goes back to the plant: computed, unless the driver overrode it. */
  const returnQtyOf = (pid: string, loadedQty: number) =>
    returnEdit[pid]?.qty ?? remainingOf(pid, loadedQty);
  const totalReturned = load.reduce((a, l) => a + returnQtyOf(l.productId, l.qty), 0);

  const visited = useMemo(
    () => new Set(sales.map((s) => s.customerId).filter(Boolean) as string[]),
    [sales],
  );
  // Route plan: today's credit/monthly customers, first five stops.
  const routeStops = useMemo(
    () =>
      customers
        .filter((c) => c.type !== "cash")
        .slice(0, 5)
        .map((c) => c.id),
    [customers],
  );

  const customerMatches = useMemo(
    () =>
      customers
        .filter((c) => !customerQ || c.name.toLowerCase().includes(customerQ.toLowerCase()))
        .slice(0, 6),
    [customers, customerQ],
  );

  const cashUp = useMutation({
    mutationFn: async (amount: number) => {
      // Cash on the van must reach the bank: the deposit slip scan is
      // mandatory before the cash-up is accepted.
      let attachmentUrl: string | undefined;
      if (slipFile) attachmentUrl = await uploadHardCopy(slipFile, "deposit");
      await depositsRepo.record({
        source: "route",
        method: "cash",
        amountTZS: amount,
        note: t(
          `Cash-up ya gari, ${user?.name ?? ""}, ${session}`,
          `Van cash-up, ${user?.name ?? ""}, ${session}`,
        ),
        attachmentUrl,
      });
      const [latest] = await depositsRepo.list(1);
      return latest;
    },
    onSuccess: (latest) => {
      qc.invalidateQueries({ queryKey: ["deposits"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      setSlipFile(null);
      toast.success(t(`Risiti ${latest.ref} imeundwa`, `Receipt ${latest.ref} generated`));
      nav({ to: "/receipt/deposit/$id", params: { id: latest.id } });
    },
    onError: () => toast.error(t("Imeshindikana kurekodi amana", "Could not record the deposit")),
  });

  const addToCart = (pid: string) =>
    setCart((c) => {
      const ex = c.find((x) => x.productId === pid);
      if (ex) return c.map((x) => (x.productId === pid ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: pid, qty: 1 }];
    });

  const completeSale = () => {
    if (!cart.length) return;
    const cid = customer || customers[0]?.id;
    completeSaleMut.mutate(
      {
        channel: "route",
        payment,
        tier: "own",
        lines: cart.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: priceOf(l.productId),
        })),
        customerId: cid,
        locationId: "loc-van1",
      },
      {
        onSuccess: () => {
          toast.success(t("Mauzo yamehifadhiwa", "Sale recorded"));
          setCart([]);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("customer-overdue")
              ? t("Mteja ana deni lililochelewa", "Customer is overdue, credit blocked")
              : e.message.includes("day-locked")
                ? t("Siku hii imefungwa", "This day is locked")
                : t("Imeshindikana kurekodi mauzo", "Could not record the sale"),
          ),
      },
    );
  };

  const planSelected = sellable.filter((p) => plan[p.id]?.selected);
  const planInvalid = planSelected.filter((p) => (plan[p.id]?.qty ?? 0) <= 0);

  const confirmLoad = async () => {
    const lines = planSelected
      .map((p) => ({ productId: p.id, qty: plan[p.id]?.qty ?? 0 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) {
      toast.error(t("Chagua bidhaa na ujaze idadi kwanza", "Select products and fill quantities"));
      return;
    }
    try {
      for (const l of lines) {
        const item = stockItemOf(l.productId);
        if (!item) continue;
        await new Promise<void>((resolve, reject) =>
          recordTransfer.mutate(
            {
              fromLocation: "loc-main",
              toLocation: "loc-van1",
              stockItemId: item.id,
              qty: l.qty,
              note: t("Upakiaji wa gari", "Van load-out"),
            },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          ),
        );
      }
      await saveVanLoad.mutateAsync({ date: today, lines });
      toast.success(t("Upakiaji umerekodiwa", "Load-out recorded"));
    } catch {
      toast.error(t("Imeshindikana kurekodi upakiaji", "Could not record the load-out"));
    }
  };

  const saveReturns = async () => {
    const entries = load
      .map((l) => ({
        pid: l.productId,
        qty: returnQtyOf(l.productId, l.qty),
        edit: returnEdit[l.productId],
      }))
      .filter((e) => e.qty > 0);
    if (entries.length === 0) {
      toast.error(t("Hakuna marejesho ya kuhifadhi", "Nothing to return yet"));
      return;
    }
    try {
      for (const e of entries) {
        const item = stockItemOf(e.pid);
        if (!item) continue;
        const reasonLabel = e.edit
          ? e.edit.reason === "other"
            ? e.edit.custom
            : (RETURN_REASONS.find((r) => r.id === e.edit!.reason)?.en ?? e.edit.reason)
          : undefined;
        await new Promise<void>((resolve, reject) =>
          recordReturn.mutate(
            {
              stockItemId: item.id,
              qty: e.qty,
              locationId: "loc-van1",
              note: reasonLabel ? `driver-override: ${reasonLabel}` : undefined,
            },
            { onSuccess: () => resolve(), onError: (err) => reject(err) },
          ),
        );
      }
      setReturnsSaved(true);
      toast.success(t(`${totalReturned} zimerekodiwa`, `${totalReturned} units saved`));
    } catch {
      toast.error(t("Imeshindikana kurekodi marejesho", "Could not record returns"));
    }
  };

  if (!authReady) return null;
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
            <span>{today}</span>
          </div>
          <div className="mt-2 text-[11px] opacity-90">
            {t("Wateja waliotembelewa", "Customers visited")}:{" "}
            <span className="font-num font-bold">
              {routeStops.filter((id) => visited.has(id)).length}/{routeStops.length}
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
                  const c = customers.find((x) => x.id === cid);
                  if (!c) return null;
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
            {!loadConfirmed ? (
              /* Planning: every product proposed, driver keeps what is real. */
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {t("Pakia gari", "Load the van")}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t(
                    "Ondoa tiki bidhaa usizonazo, jaza idadi ya ulizonazo, kisha thibitisha. Zisizochaguliwa zitaondolewa.",
                    "Untick what you do not have, fill quantities for what you do, then confirm. Unselected products will be removed.",
                  )}
                </p>
                <ul className="space-y-2">
                  {sellable.map((p) => {
                    const line = plan[p.id] ?? { selected: true, qty: 0 };
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${line.selected ? "bg-secondary/60" : "bg-secondary/25 opacity-60"}`}
                      >
                        <Checkbox
                          checked={line.selected}
                          onCheckedChange={(v) =>
                            setPlan((pl) => ({
                              ...pl,
                              [p.id]: { ...line, selected: v === true },
                            }))
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.swName}</div>
                        </div>
                        {line.selected && (
                          <Input
                            type="number"
                            min={0}
                            value={line.qty || ""}
                            placeholder="0"
                            onChange={(e) =>
                              setPlan((pl) => ({
                                ...pl,
                                [p.id]: { ...line, qty: Number(e.target.value) },
                              }))
                            }
                            className="h-8 w-20 text-right font-num"
                          />
                        )}
                        <span className="text-[10px] text-muted-foreground w-7">{p.unit}</span>
                      </li>
                    );
                  })}
                </ul>
                <ConfirmDialog
                  title={t("Thibitisha upakiaji?", "Confirm the load?")}
                  description={t(
                    `Bidhaa ${planSelected.length - planInvalid.length} zitapakiwa. Bidhaa zisizochaguliwa zitaondolewa kwenye orodha ya leo.`,
                    `${planSelected.length - planInvalid.length} products will be loaded. Unselected products are removed from today's lists.`,
                  )}
                  confirmLabel={t("Thibitisha", "Confirm")}
                  onConfirm={() => void confirmLoad()}
                  trigger={
                    <Button
                      className="mt-3 w-full text-white"
                      style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                      disabled={recordTransfer.isPending || saveVanLoad.isPending}
                    >
                      <Truck className="h-4 w-4 mr-1.5" />
                      {recordTransfer.isPending || saveVanLoad.isPending
                        ? t("Inarekodi…", "Recording…")
                        : t("Hifadhi upakiaji", "Save load-out")}
                    </Button>
                  }
                />
                {planInvalid.length > 0 && (
                  <div className="mt-2 rounded-lg bg-[#E5A100]/10 text-[#8a5a00] px-3 py-2 text-[11px]">
                    {t(
                      `Bidhaa ${planInvalid.length} zilizochaguliwa hazina idadi; zitarukwa.`,
                      `${planInvalid.length} selected products have no quantity; they will be skipped.`,
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Confirmed: the saved load with live remaining counts. */
              <div className="rounded-2xl bg-card border border-border p-4">
                <div className="font-semibold mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {t("Bidhaa zilizo kwenye gari", "On the van")}
                  <CheckCircle2 className="h-4 w-4 text-[#1E7C3F] ml-auto" />
                </div>
                <ul className="space-y-2">
                  {load.map((l) => {
                    const p = productOf(l.productId);
                    if (!p) return null;
                    const sold = soldByProduct[l.productId] ?? 0;
                    const remaining = remainingOf(l.productId, l.qty);
                    return (
                      <li key={l.productId} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.swName}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-num font-bold">
                              {num(remaining)} / {num(l.qty)} {p.unit}
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
                              width: `${l.qty > 0 ? (remaining / l.qty) * 100 : 0}%`,
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
            )}
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
                <Select value={customer || customers[0]?.id} onValueChange={setCustomer}>
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

              {load.length === 0 ? (
                <div className="rounded-xl bg-[#E5A100]/10 text-[#8a5a00] px-3 py-2 text-xs">
                  {t(
                    "Thibitisha upakiaji kwanza kwenye kichupo cha Pakia.",
                    "Confirm the load first on the Load tab.",
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label>{t("Bidhaa", "Products")}</Label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSellStyle("grid")}
                        className={`rounded-md p-1.5 ${sellStyle === "grid" ? "bg-[#1E7C3F]/10 text-[#1E7C3F]" : "text-muted-foreground"}`}
                        title={t("Mpangilio wa gridi", "Grid layout")}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setSellStyle("list")}
                        className={`rounded-md p-1.5 ${sellStyle === "list" ? "bg-[#1E7C3F]/10 text-[#1E7C3F]" : "text-muted-foreground"}`}
                        title={t("Mpangilio wa orodha", "List layout")}
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {sellStyle === "grid" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {load.map((l) => {
                        const p = productOf(l.productId);
                        if (!p) return null;
                        const remaining = remainingOf(l.productId, l.qty);
                        return (
                          <button
                            key={l.productId}
                            disabled={remaining === 0}
                            onClick={() => addToCart(l.productId)}
                            className={`rounded-xl border border-border bg-background p-3 text-left ${remaining === 0 ? "opacity-50" : "hover:border-[#2F9E44]"}`}
                          >
                            <div className="text-xs font-semibold">{p.name}</div>
                            <div className="font-num text-sm font-bold mt-1">
                              {num(priceOf(p.id))}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {num(remaining)} {p.unit} {t("zinabakia", "left")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {load.map((l) => {
                        const p = productOf(l.productId);
                        if (!p) return null;
                        const remaining = remainingOf(l.productId, l.qty);
                        return (
                          <li key={l.productId}>
                            <button
                              disabled={remaining === 0}
                              onClick={() => addToCart(l.productId)}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${remaining === 0 ? "opacity-50" : "hover:bg-accent/40"}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{p.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {num(remaining)} {p.unit} {t("zinabakia", "left")}
                                </div>
                              </div>
                              <div className="font-num text-sm font-bold">{num(priceOf(p.id))}</div>
                              <Plus className="h-3.5 w-3.5 text-[#1E7C3F]" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}

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
                    const p = productOf(l.productId);
                    if (!p) return null;
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
                          {num(priceOf(l.productId) * l.qty)}
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
                disabled={cart.length === 0 || completeSaleMut.isPending}
                className="w-full h-11 text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                onClick={completeSale}
              >
                <Receipt className="h-4 w-4 mr-1.5" />{" "}
                {completeSaleMut.isPending
                  ? t("Inahifadhi…", "Saving…")
                  : t("Kamilisha mauzo", "Complete sale")}
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
                        <div className="font-medium">
                          {s.customerName ?? t("Mteja wa kupita", "Walk-in")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {s.payment}
                        </div>
                      </div>
                      <div className="font-num font-semibold">{tzs(s.totalTZS)}</div>
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
              <p className="text-xs text-muted-foreground">
                {t(
                  "Marejesho yanahesabiwa otomatiki: kilichopakiwa kasoro kilichouzwa. Ukibadilisha, lazima utoe sababu.",
                  "Returns are computed automatically: loaded minus sold. If you change a number, a reason is required.",
                )}
              </p>
              {load.length === 0 ? (
                <div className="rounded-xl bg-[#E5A100]/10 text-[#8a5a00] px-3 py-2 text-xs">
                  {t("Thibitisha upakiaji kwanza.", "Confirm the load first.")}
                </div>
              ) : (
                load.map((l) => {
                  const p = productOf(l.productId);
                  if (!p) return null;
                  const computed = remainingOf(l.productId, l.qty);
                  const edit = returnEdit[l.productId];
                  const isEditing = editingReturn === l.productId;
                  return (
                    <div key={l.productId} className="rounded-xl bg-secondary/60 p-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("Imepakiwa", "Loaded")} {num(l.qty)} · {t("Imeuzwa", "Sold")}{" "}
                            {num(soldByProduct[l.productId] ?? 0)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-num font-bold">
                            {num(returnQtyOf(l.productId, l.qty))} {p.unit}
                          </div>
                          {edit ? (
                            <div className="text-[10px] text-[#8a5a00]">
                              {t("Imebadilishwa", "Overridden")} ({num(computed)}{" "}
                              {t("kihesabu", "computed")})
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">
                              {t("Kihesabu", "Computed")}
                            </div>
                          )}
                        </div>
                        {!returnsSaved && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 ml-1"
                            title={t("Badilisha", "Edit")}
                            onClick={() =>
                              setEditingReturn((cur) => (cur === l.productId ? null : l.productId))
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {isEditing && (
                        <ReturnOverrideForm
                          unit={p.unit}
                          computed={computed}
                          initial={edit}
                          onCancel={() => setEditingReturn(null)}
                          onApply={(qty, reason, custom) => {
                            setReturnEdit((r) => ({
                              ...r,
                              [l.productId]: { qty, reason, custom },
                            }));
                            setEditingReturn(null);
                          }}
                          onReset={() => {
                            setReturnEdit((r) => {
                              const next = { ...r };
                              delete next[l.productId];
                              return next;
                            });
                            setEditingReturn(null);
                          }}
                        />
                      )}
                    </div>
                  );
                })
              )}
              {load.length > 0 && !returnsSaved && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={recordReturn.isPending}
                  onClick={saveReturns}
                >
                  {recordReturn.isPending
                    ? t("Inahifadhi…", "Saving…")
                    : t(
                        `Hifadhi marejesho (${num(totalReturned)})`,
                        `Save returns (${num(totalReturned)})`,
                      )}
                </Button>
              )}
              {returnsSaved && (
                <div className="rounded-xl bg-[#2F9E44]/10 text-[#14532D] px-3 py-2 text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("Marejesho yamehifadhiwa", "Returns saved")}
                </div>
              )}
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
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("Risiti ya benki (lazima kwa cash)", "Bank deposit slip (required for cash)")}
                </Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                <div className="text-[11px] text-muted-foreground">
                  {t(
                    "Weka cash benki kwanza, kisha pakia picha ya risiti hapa. Finance wataiona kwenye daftari la amana.",
                    "Bank the cash first, then upload a photo of the slip here. Finance sees it in the deposits log.",
                  )}
                </div>
              </div>
              <Button
                className="w-full text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                disabled={cashUp.isPending}
                onClick={() => {
                  const amount = deposit || expectedDeposit;
                  if (amount <= 0) {
                    toast.error(t("Hakuna cash ya kuhifadhi", "No cash to deposit yet"));
                    return;
                  }
                  if (cashTotal > 0 && !slipFile) {
                    toast.error(
                      t(
                        "Pakia risiti ya benki kwanza, ni lazima kwa mauzo ya cash",
                        "Upload the bank slip first, it is required for cash sales",
                      ),
                    );
                    return;
                  }
                  setDeposit(amount);
                  cashUp.mutate(amount);
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                {cashUp.isPending
                  ? t("Inatengeneza…", "Generating…")
                  : t("Tengeneza risiti", "Generate receipt")}
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
                      {slipFile ? ` · ${slipFile.name}` : ""}
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

/** Inline editor for one return line: new quantity + mandatory reason. */
function ReturnOverrideForm({
  unit,
  computed,
  initial,
  onApply,
  onReset,
  onCancel,
}: {
  unit: string;
  computed: number;
  initial?: { qty: number; reason: string; custom: string };
  onApply: (qty: number, reason: string, custom: string) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const { t, lang } = useApp();
  const [qty, setQty] = useState(initial?.qty ?? computed);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [custom, setCustom] = useState(initial?.custom ?? "");
  const valid = qty >= 0 && reason !== "" && (reason !== "other" || custom.trim().length > 0);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="h-8 flex-1 text-right font-num"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t("Sababu ya kubadilisha (lazima)", "Reason (required)")} />
        </SelectTrigger>
        <SelectContent>
          {RETURN_REASONS.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {lang === "sw" ? r.sw : r.en}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {reason === "other" && (
        <Input
          value={custom}
          maxLength={200}
          onChange={(e) => setCustom(e.target.value)}
          className="h-8 text-xs"
          placeholder={t("Andika sababu fupi…", "Type a short reason…")}
        />
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          disabled={!valid}
          onClick={() => onApply(qty, reason, custom.trim())}
        >
          {t("Weka", "Apply")}
        </Button>
        {initial && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReset}>
            {t("Rudisha kihesabu", "Use computed")}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          {t("Ghairi", "Cancel")}
        </Button>
      </div>
    </div>
  );
}
