import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: a raw-milk-focused read of the same conservation ledger Day
// reconciliation already keeps (opening + collected + produced = sold +
// separated + spoilt + closing), scoped to fresh milk and mtindi
// combined, with collected split into Baraka Farm vs every other farmer,
// and sold split into ordinary sales vs bills to monthly customers. This
// is a report over the existing ledger, it does not lock a day, see
// src/lib/data/milkCollections.
import {
  useMilkCollectionsSummary,
  useMilkBillLines,
  useManualMilkBills,
  useRecordManualMilkBill,
  useDeleteManualMilkBill,
} from "@/lib/data/hooks/milkCollections";
import { useFarmers } from "@/lib/data/hooks/farmers";
import { useRecordCollectionDay } from "@/lib/data/hooks/collections";
import { useLocations } from "@/lib/data/hooks/locations";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard } from "@/components/ui/data-bits";
import { num, L } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { ChevronLeft, ChevronRight, Plus, Droplets } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Grain = "day" | "month" | "year";

export function MilkCollectionsScreen() {
  const { t, lang, can } = useApp();
  const canWrite = can("collection:write");
  const today = todayISO();

  const [grain, setGrain] = useState<Grain>("day");
  const [anchor, setAnchor] = useState(today);
  const [y, m, d] = anchor.split("-").map(Number);

  const range = (() => {
    if (grain === "day") return { from: anchor, to: anchor };
    if (grain === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
    const last = new Date(y, m, 0).getDate();
    return {
      from: `${anchor.slice(0, 7)}-01`,
      to: `${anchor.slice(0, 7)}-${String(last).padStart(2, "0")}`,
    };
  })();

  const shift = (delta: number) => {
    const dt = new Date(y, m - 1, d);
    if (grain === "day") dt.setDate(dt.getDate() + delta);
    else if (grain === "month") dt.setMonth(dt.getMonth() + delta);
    else dt.setFullYear(dt.getFullYear() + delta);
    setAnchor(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
    );
  };

  const windowLabel =
    grain === "day"
      ? new Date(`${anchor}T00:00:00`).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : grain === "month"
        ? new Date(`${anchor.slice(0, 7)}-01T00:00:00`).toLocaleDateString(
            lang === "sw" ? "sw-TZ" : "en-GB",
            { month: "long", year: "numeric" },
          )
        : String(y);

  const atLatest = grain === "year" ? y >= Number(today.slice(0, 4)) : anchor >= today;

  const { data: days = [], isPending } = useMilkCollectionsSummary(range.from, range.to);

  const totals = days.reduce(
    (a, x) => ({
      baraka: a.baraka + x.barakaLitres,
      farmers: a.farmers + x.farmersLitres,
      produced: a.produced + x.produced,
      soldOther: a.soldOther + x.soldOther,
      billsAuto: a.billsAuto + x.billsAuto,
      billsManual: a.billsManual + x.billsManual,
      separated: a.separated + x.separated,
      spoilt: a.spoilt + x.spoilt,
    }),
    {
      baraka: 0,
      farmers: 0,
      produced: 0,
      soldOther: 0,
      billsAuto: 0,
      billsManual: 0,
      separated: 0,
      spoilt: 0,
    },
  );
  // Rows come back newest first, so the last row is the window's start
  // and the first row is its end.
  const openingStart = days.length > 0 ? days[days.length - 1].opening : 0;
  const closingEnd = days.length > 0 ? days[0].closing : 0;
  const collectedTotal = totals.baraka + totals.farmers;
  const billsTotal = totals.billsAuto + totals.billsManual;

  return (
    <AppShell title={t("Ukusanyaji wa maziwa", "Milk collections")}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["day", "month", "year"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrain(g)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  grain === g ? "text-white" : "hover:bg-accent"
                }`}
                style={grain === g ? { background: "#1E7C3F" } : undefined}
              >
                {g === "day"
                  ? t("Siku", "Day")
                  : g === "month"
                    ? t("Mwezi", "Month")
                    : t("Mwaka", "Year")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold min-w-[10rem] text-center">{windowLabel}</span>
            <button
              type="button"
              onClick={() => shift(1)}
              disabled={atLatest}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {canWrite && <RecordBarakaMilkDialog defaultDate={grain === "day" ? anchor : today} />}
      </div>

      {isPending ? (
        <SectionSkeleton>
          <TableSkeleton rows={6} cols={5} />
        </SectionSkeleton>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={t("Zilizokusanywa", "Collected")}
              value={L(collectedTotal)}
              accent="info"
            />
            <StatCard label={t("Baridi (mwanzo)", "Opening (baridi)")} value={L(openingStart)} />
            <StatCard label={t("Bili", "Bills")} value={L(billsTotal)} accent="amber" />
            <StatCard label={t("Kilichosalia", "Remaining")} value={L(closingEnd)} accent="green" />
          </div>

          <SectionCard title={t("Chanzo cha maziwa", "Where the milk came from")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Chanzo", "Source")}</th>
                    <th className="text-right px-3">{t("Lita", "Litres")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Baraka Farm", "Baraka Farm")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.baraka)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Wakulima wengine", "Other farmers")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.farmers)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">
                      {t("Baridi (kilichobaki jana)", "Baridi (left over from before)")}
                    </td>
                    <td className="py-2.5 text-right px-3 font-num">{num(openingStart)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Uzalishaji (mtindi)", "Produced (mtindi)")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.produced)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-bold">
                      {t("Jumla inayopatikana", "Total available")}
                    </td>
                    <td className="py-3 text-right px-3 font-num font-bold text-base">
                      {num(openingStart + collectedTotal + totals.produced)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title={t("Matumizi ya maziwa", "Where the milk went")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Matumizi", "Use")}</th>
                    <th className="text-right px-3">{t("Lita", "Litres")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Mauzo", "Sold")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.soldOther)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">
                      {t("Bili (wateja wa mwezi)", "Bills (monthly customers)")}
                    </td>
                    <td className="py-2.5 text-right px-3 font-num">{num(billsTotal)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Kutengwa", "Separated")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.separated)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-3">{t("Uharibifu", "Spoilage")}</td>
                    <td className="py-2.5 text-right px-3 font-num">{num(totals.spoilt)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-bold">{t("Kilichosalia", "Remaining")}</td>
                    <td className="py-3 text-right px-3 font-num font-bold text-base">
                      {num(closingEnd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              {t(
                "Kilichosalia leo ndicho baridi cha kesho, kinachoendelea kila siku.",
                "Today's remaining is tomorrow's baridi, carried forward every day.",
              )}
            </div>
          </SectionCard>

          {grain === "day" && <DayBillReview date={anchor} canWrite={canWrite} />}

          {grain !== "day" && days.length > 0 && (
            <SectionCard title={t("Kila siku", "Day by day")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                      <th className="text-right">{t("Baraka", "Baraka")}</th>
                      <th className="text-right">{t("Wakulima", "Farmers")}</th>
                      <th className="text-right">{t("Baridi", "Opening")}</th>
                      <th className="text-right">{t("Uzalishaji", "Produced")}</th>
                      <th className="text-right">{t("Mauzo", "Sold")}</th>
                      <th className="text-right">{t("Bili", "Bills")}</th>
                      <th className="text-right">{t("Kutengwa", "Separated")}</th>
                      <th className="text-right">{t("Uharibifu", "Spoilage")}</th>
                      <th className="text-right px-3">{t("Salio", "Closing")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...days]
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((x) => (
                        <tr key={x.date} className="border-b border-border last:border-0">
                          <td className="py-2 px-3 font-num text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setGrain("day");
                                setAnchor(x.date);
                              }}
                              className="text-muted-foreground hover:underline"
                            >
                              {x.date}
                            </button>
                          </td>
                          <td className="py-2 text-right font-num">{num(x.barakaLitres)}</td>
                          <td className="py-2 text-right font-num">{num(x.farmersLitres)}</td>
                          <td className="py-2 text-right font-num">{num(x.opening)}</td>
                          <td className="py-2 text-right font-num">{num(x.produced)}</td>
                          <td className="py-2 text-right font-num">{num(x.soldOther)}</td>
                          <td className="py-2 text-right font-num">
                            {num(x.billsAuto + x.billsManual)}
                          </td>
                          <td className="py-2 text-right font-num">{num(x.separated)}</td>
                          <td className="py-2 text-right font-num">{num(x.spoilt)}</td>
                          <td className="py-2 text-right px-3 font-num font-semibold">
                            {num(x.closing)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
}

// The hybrid bill review for one day: real sales to monthly customers
// (fresh milk or mtindi) show up pre-checked, unchecking one drops it
// from the day's Bills total shown above, and a manual line covers a
// bill that is not tied to an actual customer sale.
function DayBillReview({ date, canWrite }: { date: string; canWrite: boolean }) {
  const { t } = useApp();
  const { data: lines = [], isPending: linesPending } = useMilkBillLines(date);
  const { data: manual = [], isPending: manualPending } = useManualMilkBills(date);
  const recordManual = useRecordManualMilkBill();
  const deleteManual = useDeleteManualMilkBill();

  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [manualLitres, setManualLitres] = useState<number | "">("");
  const [manualNote, setManualNote] = useState("");

  const checkedTotal = useMemo(
    () => lines.filter((l) => !unchecked.has(l.id)).reduce((a, l) => a + l.litres, 0),
    [lines, unchecked],
  );
  const manualTotal = manual.reduce((a, x) => a + x.litres, 0);

  const toggle = (id: string) =>
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addManual = () => {
    if (manualLitres === "" || Number(manualLitres) <= 0) return;
    recordManual.mutate(
      { date, litres: Number(manualLitres), note: manualNote || undefined },
      {
        onSuccess: () => {
          toast.success(t("Imeongezwa", "Added"));
          setManualLitres("");
          setManualNote("");
        },
        onError: () => toast.error(t("Imeshindikana", "Could not add it")),
      },
    );
  };

  if (linesPending || manualPending) {
    return (
      <SectionSkeleton>
        <TableSkeleton rows={4} cols={3} />
      </SectionSkeleton>
    );
  }

  return (
    <SectionCard title={t("Bili za wateja wa mwezi, siku hii", "Monthly-customer bills, this day")}>
      {lines.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title={t(
            "Hakuna mauzo ya wateja wa mwezi siku hii",
            "No monthly-customer sales this day",
          )}
        />
      ) : (
        <ul className="divide-y divide-border text-sm mb-3">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2">
              <Checkbox checked={!unchecked.has(line.id)} onCheckedChange={() => toggle(line.id)} />
              <span className="flex-1">
                {line.customerName}
                <span className="ml-2 text-xs text-muted-foreground">{line.productName}</span>
              </span>
              <span className="font-num font-semibold">{num(line.litres)} L</span>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-xl bg-secondary/60 px-3 py-2 flex items-center justify-between text-sm mb-3">
        <span className="text-muted-foreground">{t("Jumla iliyochaguliwa", "Checked total")}</span>
        <span className="font-num font-bold">{num(checkedTotal)} L</span>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {t("Bili za mkono", "Manual bills")}
      </div>
      {manual.length > 0 && (
        <ul className="divide-y divide-border text-sm mb-3">
          {manual.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {num(b.litres)} L
                {b.note && <span className="ml-2 text-xs text-muted-foreground">{b.note}</span>}
              </span>
              {canWrite && (
                <ConfirmDialog
                  destructive
                  title={t("Futa bili hii?", "Remove this bill?")}
                  description={t("Haiwezi kurudishwa.", "This cannot be undone.")}
                  confirmLabel={t("Futa", "Remove")}
                  onConfirm={() =>
                    deleteManual.mutate(b.id, {
                      onSuccess: () => toast.success(t("Imefutwa", "Removed")),
                      onError: () => toast.error(t("Imeshindikana", "Could not remove it")),
                    })
                  }
                  trigger={
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-[#E11B22]">
                      {t("Futa", "Remove")}
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("Lita", "Litres")}</Label>
            <Input
              type="number"
              step="any"
              min={0}
              value={manualLitres}
              onChange={(e) => setManualLitres(e.target.value === "" ? "" : Number(e.target.value))}
              className="font-num"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("Maelezo (hiari)", "Note (optional)")}</Label>
            <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={manualLitres === "" || Number(manualLitres) <= 0 || recordManual.isPending}
            onClick={addManual}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("Ongeza", "Add")}
          </Button>
        </div>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        {t(
          "Bili ya siku hii ni jumla iliyochaguliwa hapo juu pamoja na bili za mkono.",
          "This day's Bills figure is the checked total above plus the manual bills.",
        )}
      </div>
    </SectionCard>
  );
}

// Baraka Farm is a normal farmer underneath (rate 0, tracked but never
// paid), so recording her milk reuses the exact same record_collection_day
// RPC every other farmer's daily collection already goes through. This is
// just a shortcut to it from the Milk collections page, so adding her
// day's litres doesn't mean a detour to the Farmers screen.
function RecordBarakaMilkDialog({ defaultDate }: { defaultDate: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [morningLitres, setMorningLitres] = useState<number | "">("");
  const [eveningLitres, setEveningLitres] = useState<number | "">("");
  const { data: farmers = [] } = useFarmers();
  const { data: locations = [] } = useLocations();
  const points = locations.filter(
    (l) => l.active && (l.kind === "collection-point" || l.kind === "plant"),
  );
  const [locationId, setLocationId] = useState("");
  const record = useRecordCollectionDay();

  const baraka = farmers.find((f) => f.name === "Baraka Farm");
  const total =
    (morningLitres === "" ? 0 : morningLitres) + (eveningLitres === "" ? 0 : eveningLitres);

  const save = () => {
    if (!baraka || total <= 0) return;
    record.mutate(
      {
        farmerId: baraka.id,
        date,
        locationId: locationId || points[0]?.id || "loc-main",
        morningLitres: morningLitres === "" ? 0 : morningLitres,
        eveningLitres: eveningLitres === "" ? 0 : eveningLitres,
      },
      {
        onSuccess: () => {
          toast.success(t("Imerekodiwa", "Recorded"));
          setOpen(false);
          setMorningLitres("");
          setEveningLitres("");
        },
        onError: (e: Error) =>
          toast.error(
            e.message.includes("future-date")
              ? t("Huwezi kurekodi tarehe ijayo", "You cannot record a future date")
              : e.message.includes("day-locked")
                ? t("Siku hii imefungwa", "This day is locked")
                : t("Imeshindikana kurekodi", "Could not record it"),
          ),
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
          disabled={!baraka}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Maziwa ya Baraka Farm", "Baraka Farm's milk")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekodi maziwa ya Baraka Farm", "Record Baraka Farm's milk")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Sehemu", "Location")}</Label>
              <Select value={locationId || points[0]?.id} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {points.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Asubuhi (L)", "Morning (L)")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                placeholder="0"
                value={morningLitres}
                onChange={(e) =>
                  setMorningLitres(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="font-num"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Jioni (L)", "Evening (L)")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                placeholder="0"
                value={eveningLitres}
                onChange={(e) =>
                  setEveningLitres(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="font-num"
              />
            </div>
          </div>
          {total > 0 && (
            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
              {t(`Jumla ya lita ${num(total)}`, `Total ${num(total)} L`)}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={total <= 0 || record.isPending}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
