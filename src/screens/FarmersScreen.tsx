import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/farmers + collections (was @/mock/data).
import {
  useFarmers,
  useCycleSummary,
  useFarmerPayouts,
  useCreateFarmer,
  useUpdateFarmer,
  useDeleteFarmer,
  usePayFarmer,
  useFarmerAdjustments,
  useRequestAdjustment,
  useReviewAdjustment,
  useFarmerMonthlySummary,
} from "@/lib/data/hooks/farmers";
import { useRecordCollectionDay } from "@/lib/data/hooks/collections";
import { useLocations } from "@/lib/data/hooks/locations";
import { useQuery } from "@tanstack/react-query";
import { collectionKeys, collectionsRepo } from "@/lib/data/collections";
import { todayISO, dateLabel } from "@/lib/data/dates";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, L, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  Wallet,
  FileText,
  Users,
  UserPlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { RowActions } from "@/components/ui/RowActions";
import { ImportCollectionsDialog } from "@/screens/ImportCollectionsDialog";
import type { Farmer } from "@/mock/types";

const VILLAGES = ["Olasiti", "Sakina", "Kisongo", "Ngaramtoni", "Tengeru", "Usa River"];

export function FarmersScreen() {
  const { t, can } = useApp();
  const canWrite = can("farmers:write");
  const { data: farmers = [], isPending, isError, refetch } = useFarmers();
  const { data: cycle } = useCycleSummary();
  const deleteFarmer = useDeleteFarmer();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      farmers.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (filter !== "all" && f.status !== filter) return false;
        return true;
      }),
    [q, filter, farmers],
  );

  const totalLitres = farmers.reduce((a, f) => a + f.litresThisCycle, 0);
  const totalDue = farmers.reduce((a, f) => a + f.currentBalanceTZS, 0);
  const totalFarmers = farmers.length;
  const dueCount = farmers.filter((f) => f.status === "due" || f.status === "delayed").length;

  if (isPending) {
    return (
      <AppShell title={t("Wafugaji", "Farmers")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={7} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title={t("Wafugaji", "Farmers")}>
        <EmptyState
          icon={Users}
          title={t("Imeshindikana kupakia wafugaji", "Could not load farmers")}
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
    <AppShell title={t("Wafugaji", "Farmers")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Jumla wafugaji", "Total farmers")}
          value={num(totalFarmers)}
          accent="green"
        />
        <StatCard
          label={t("Litre mzunguko huu", "Litres this cycle")}
          value={L(totalLitres)}
          accent="info"
        />
        <StatCard
          label={t("Inadaiwa kulipwa", "Payable now")}
          value={tzs(totalDue)}
          accent="amber"
        />
        <StatCard label={t("Wanaodai", "Awaiting payment")} value={num(dueCount)} accent="red" />
      </div>

      <SectionCard
        title={t("Orodha ya wafugaji", "Farmer list")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
                placeholder={t("Tafuta jina…", "Search name…")}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Wote", "All")}</SelectItem>
                <SelectItem value="active">{t("Wanaoendelea", "Active")}</SelectItem>
                <SelectItem value="due">{t("Wanaodai", "Due")}</SelectItem>
                <SelectItem value="delayed">{t("Wamechelewa", "Delayed")}</SelectItem>
                <SelectItem value="paid">{t("Wamelipwa", "Paid")}</SelectItem>
              </SelectContent>
            </Select>
            <ExportMenu
              formats={["excel", "csv", "pdf"]}
              filename="farmers"
              data={() => ({
                title: t("Orodha ya wafugaji", "Farmer list"),
                headers: [
                  "Name",
                  "Phone",
                  "Village",
                  "Litres this cycle",
                  "Rate TZS/L",
                  "Balance TZS",
                  "Status",
                ],
                rows: filtered.map((f) => [
                  f.name,
                  f.phone,
                  f.village,
                  f.litresThisCycle,
                  f.ratePerL,
                  f.currentBalanceTZS,
                  f.status,
                ]),
              })}
            />
            {canWrite && <AddFarmerDialog />}
            {can("collection:write") && <ImportCollectionsDialog farmers={farmers} />}
            {can("collection:write") && <RecordCollectionDialog farmers={farmers} />}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("Hakuna wafugaji wanaolingana", "No matching farmers")}
            description={t(
              "Jaribu kubadili kichujio au utafutaji.",
              "Try adjusting the filter or search.",
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th>
                  <th className="py-2 px-3">{t("Kijiji", "Village")}</th>
                  <th className="py-2 px-3 text-right">{t("Litre", "Litres")}</th>
                  <th className="py-2 px-3 text-right">TZS/L</th>
                  <th className="py-2 px-3 text-right">{t("Inadaiwa", "Balance")}</th>
                  <th className="py-2 px-3">{t("Malipo ya mwisho", "Last payment")}</th>
                  <th className="py-2 px-3">{t("Hali", "Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {f.phone}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{f.village}</td>
                    <td className="py-2.5 px-3 text-right font-num">{num(f.litresThisCycle)}</td>
                    <td className="py-2.5 px-3 text-right font-num">{num(f.ratePerL)}</td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold">
                      {tzs(f.currentBalanceTZS)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {f.lastPaymentDate || "–"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Pill
                        tone={
                          f.status === "delayed"
                            ? "danger"
                            : f.status === "due"
                              ? "warning"
                              : f.status === "paid"
                                ? "success"
                                : "info"
                        }
                      >
                        {f.status === "delayed"
                          ? t("Imechelewa", "Delayed")
                          : f.status === "due"
                            ? t("Inadaiwa", "Due")
                            : f.status === "paid"
                              ? t("Imelipwa", "Paid")
                              : t("Hai", "Active")}
                      </Pill>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <RowActions
                        itemName={f.name}
                        onView={() => setViewingId(f.id)}
                        onEdit={canWrite ? () => setEditingId(f.id) : undefined}
                        onDelete={
                          !canWrite
                            ? undefined
                            : () => {
                                deleteFarmer.mutate(
                                  { id: f.id, name: f.name },
                                  {
                                    onSuccess: () =>
                                      toast.success(t("Mfugaji amefutwa", "Farmer deleted")),
                                    onError: () =>
                                      toast.error(
                                        t("Imeshindikana kufuta", "Could not delete farmer"),
                                      ),
                                  },
                                );
                              }
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      {viewingId && (
        <FarmerDetailDrawer
          farmer={farmers.find((x) => x.id === viewingId)!}
          open
          onClose={() => setViewingId(null)}
        />
      )}
      {editingId && (
        <EditFarmerDialog
          farmer={farmers.find((x) => x.id === editingId)!}
          onClose={() => setEditingId(null)}
        />
      )}

      <div className="mt-5">
        <SectionCard title={t("Mzunguko wa malipo (siku 15)", "Payment cycle (15 days)")}>
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                {t("Mzunguko wa sasa", "Current cycle")}:{" "}
                {cycle
                  ? `${dateLabel(cycle.startDate)} – ${dateLabel(cycle.endDate)}`
                  : t("Hakuna mzunguko wazi", "No open cycle")}
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full brand-gradient"
                  style={{
                    width: cycle
                      ? `${Math.round((cycle.daysElapsed / cycle.daysTotal) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span>
                  {t("Siku zilizopita", "Days elapsed")}: {cycle?.daysElapsed ?? 0}/
                  {cycle?.daysTotal ?? 15}
                </span>
                <span className="font-num">{tzs(totalDue)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("Wamelipwa", "Paid")}
                </div>
                <div className="font-num font-bold text-lg">{tzs(cycle?.paidTZS ?? 0)}</div>
              </div>
              <div className="rounded-xl bg-secondary/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("Wanasubiri", "Pending")}
                </div>
                <div className="font-num font-bold text-lg">{tzs(totalDue)}</div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <AdjustmentsSection />
    </AppShell>
  );
}

function RecordCollectionDialog({ farmers }: { farmers: Farmer[] }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [farmerId, setFarmerId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  // One save for the whole day: morning and evening litres side by side,
  // either can be left at zero. Replaces picking a session and visiting
  // this dialog twice.
  const [morningLitres, setMorningLitres] = useState(0);
  const [eveningLitres, setEveningLitres] = useState(0);
  // Intake points come from the locations table: every active collection
  // point or plant, managed from the Collection points screen or Settings.
  const { data: locations = [] } = useLocations();
  const points = locations.filter(
    (l) => l.active && (l.kind === "collection-point" || l.kind === "plant"),
  );
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");
  const record = useRecordCollectionDay();
  const total = morningLitres + eveningLitres;

  const save = () => {
    const fid = farmerId || farmers[0]?.id;
    if (!fid || total <= 0) return;
    record.mutate(
      {
        farmerId: fid,
        date,
        locationId: locationId || points[0]?.id || "loc-main",
        morningLitres,
        eveningLitres,
        qualityNote: note || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("Ukusanyaji umerekodiwa", "Collection recorded"));
          setOpen(false);
          setNote("");
          setMorningLitres(0);
          setEveningLitres(0);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("day-locked")
              ? t("Siku hii imefungwa", "This day is locked")
              : t("Imeshindikana kurekodi", "Could not record collection"),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Rekodi ukusanyaji", "Record collection")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rekodi ukusanyaji wa maziwa", "Record milk collection")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Mfugaji", "Farmer")}</Label>
            <Select value={farmerId || farmers[0]?.id} onValueChange={setFarmerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Pointi", "Point")}</Label>
              <Select value={locationId || points[0]?.id} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {points.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {lang === "sw" ? l.swName : l.name}
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
                min={0}
                value={morningLitres}
                onChange={(e) => setMorningLitres(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Jioni (L)", "Evening (L)")}</Label>
              <Input
                type="number"
                min={0}
                value={eveningLitres}
                onChange={(e) => setEveningLitres(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">{t("Jumla ya siku", "Day total")}</span>
            <span className="font-num font-semibold">{L(total)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo (hiari)", "Notes (optional)")}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Ubora mzuri", "Good quality")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={record.isPending || total <= 0}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FarmerDetailDrawer({
  farmer: f,
  open,
  onClose,
}: {
  farmer: Farmer;
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang, can } = useApp();
  const canPay = can("payout:write");
  const canAdjust = can("farmers:write") || can("payout:write");
  const monthStart = `${todayISO().slice(0, 8)}01`;
  const { data: monthCollections = [] } = useQuery({
    queryKey: collectionKeys.byFarmer(f.id, monthStart),
    queryFn: () => collectionsRepo.listByFarmer(f.id, monthStart),
  });
  const { data: payouts = [] } = useFarmerPayouts(f.id);
  const { data: monthly = [] } = useFarmerMonthlySummary(f.id, 6);

  const litresByDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of monthCollections) {
      const d = Number(c.date.slice(8, 10));
      map[d] = (map[d] ?? 0) + c.litres;
    }
    return map;
  }, [monthCollections]);
  const todayDay = new Date().getDate();
  const monthLabel = new Date().toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-full text-white font-bold"
              style={{ background: "#1E7C3F" }}
            >
              {f.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <div>{f.name}</div>
              <div className="text-xs text-muted-foreground font-normal flex gap-2">
                <MapPin className="h-3 w-3 inline" />
                {f.village} · {f.phone}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Mzunguko huu", "This cycle")}
            </div>
            <div className="font-num font-bold">{L(f.litresThisCycle)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Inadaiwa", "Balance")}
            </div>
            <div className="font-num font-bold">{tzs(f.currentBalanceTZS)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Bei", "Rate")}
            </div>
            <div className="font-num font-bold">{num(f.ratePerL)}/L</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />{" "}
            {t(`Ukusanyaji wa mwezi, ${monthLabel}`, `Monthly collection, ${monthLabel}`)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-1"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: 31 }).map((_, i) => {
              const v = litresByDay[i + 1] ?? 0;
              const isToday = i + 1 === todayDay;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-md p-1 text-[10px] font-num font-semibold flex flex-col justify-between ${isToday ? "ring-2 ring-[#1E7C3F]" : ""}`}
                  style={{
                    background: `rgba(47,158,68,${v > 0 ? 0.1 + Math.min(v / 100, 0.7) : 0.05})`,
                    color: "#14532D",
                  }}
                  title={`Day ${i + 1}: ${v} L`}
                >
                  <span className="text-[9px] opacity-70">{i + 1}</span>
                  <span className="text-right text-[10px]">{v > 0 ? v : ""}</span>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {t("Kila kisanduku, litre kwa siku", "Each cell, litres per day")}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            {t("Malipo kwa mwezi", "Payment by month")}
          </div>
          <ul className="divide-y divide-border text-sm rounded-xl border border-border overflow-hidden">
            {monthly.map((m) => {
              const monthLabel = new Date(`${m.month}T00:00:00`).toLocaleDateString(
                lang === "sw" ? "sw-TZ" : "en-GB",
                { month: "long", year: "numeric" },
              );
              const tone =
                m.status === "paid"
                  ? "success"
                  : m.status === "partial"
                    ? "warning"
                    : m.status === "unpaid"
                      ? "danger"
                      : "slate";
              const statusLabel =
                m.status === "paid"
                  ? t("Imelipwa", "Paid")
                  : m.status === "partial"
                    ? t("Sehemu", "Partial")
                    : m.status === "unpaid"
                      ? t("Haijalipwa", "Unpaid")
                      : t("Hakuna", "None");
              return (
                <li key={m.month} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{monthLabel}</div>
                    <div className="text-xs text-muted-foreground font-num">
                      {L(m.litres)} · {t("Alipata", "Earned")} {tzs(m.earnedTZS)}
                      {m.paidTZS > 0 && (
                        <>
                          {" "}
                          · {t("Alilipwa", "Paid")} {tzs(m.paidTZS)}
                        </>
                      )}
                    </div>
                  </div>
                  <Pill tone={tone}>{statusLabel}</Pill>
                  {m.status !== "none" && (
                    <Button asChild size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                      <Link
                        to="/statement/farmer/$id"
                        params={{ id: f.id }}
                        search={{ month: m.month }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2">
            {t("Historia ya malipo", "Payment history")}
          </div>
          {payouts.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              {t("Hakuna malipo bado", "No payouts yet")}
            </div>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <div>
                    <div className="font-medium">
                      {t("Malipo ya mzunguko", "Cycle payout")} · {p.method}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.date}</div>
                  </div>
                  <div className="font-num font-semibold">{tzs(p.amountTZS)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canPay && <RecordFarmerPaymentDialog farmer={f} />}
          {canAdjust && <RequestAdjustmentDialog farmer={f} />}
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/statement/farmer/$id" params={{ id: f.id }}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t("Statimenti", "Statement")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/payout/farmer/$id" params={{ id: f.id }} search={{ cycle: undefined }}>
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              {t("Karatasi ya malipo", "Payout slip")}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddFarmerDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("Olasiti");
  const [rate, setRate] = useState(1200);
  const create = useCreateFarmer();

  const save = () => {
    if (!name.trim()) return;
    create.mutate(
      { name, phone, village, ratePerL: rate },
      {
        onSuccess: () => {
          toast.success(t("Mfugaji ameongezwa", "Farmer added"));
          setOpen(false);
          setName("");
          setPhone("");
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add farmer")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-8">
          <UserPlus className="h-3.5 w-3.5 mr-1" /> {t("Mfugaji mpya", "Add farmer")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Sajili mfugaji mpya", "Register a new farmer")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina kamili", "Full name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mama Joy" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Simu", "Phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 7xx xxx xxx"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kijiji", "Village")}</Label>
              <Select value={village} onValueChange={setVillage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VILLAGES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Bei (TZS/L)", "Rate (TZS/L)")}</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={create.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {create.isPending ? t("Inasajili…", "Registering…") : t("Sajili", "Register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFarmerDialog({ farmer, onClose }: { farmer: Farmer; onClose: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState(farmer.name);
  const [phone, setPhone] = useState(farmer.phone);
  const [village, setVillage] = useState(farmer.village);
  const [rate, setRate] = useState(farmer.ratePerL);
  const update = useUpdateFarmer();

  const save = () => {
    update.mutate(
      { id: farmer.id, name, phone, village, ratePerL: rate },
      {
        onSuccess: () => {
          toast.success(t("Imehifadhiwa", "Saved"));
          onClose();
        },
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Hariri mfugaji", "Edit farmer")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Simu", "Phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kijiji", "Village")}</Label>
              <Select value={village} onValueChange={setVillage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VILLAGES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Bei (TZS/L)", "Rate (TZS/L)")}</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordFarmerPaymentDialog({ farmer }: { farmer: Farmer }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(farmer.currentBalanceTZS);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("mpesa");
  const [ref, setRef] = useState(`PAY-${Date.now().toString().slice(-4)}`);
  const pay = usePayFarmer();

  const save = () => {
    if (amount <= 0) return;
    pay.mutate(
      { farmerId: farmer.id, amountTZS: amount, method, ref },
      {
        onSuccess: () => {
          toast.success(t(`Malipo ${tzs(amount)} yamerekodiwa`, `Payment ${tzs(amount)} recorded`));
          setOpen(false);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("amount-exceeds-balance")
              ? t("Kiasi kinazidi salio", "Amount exceeds the balance")
              : t("Imeshindikana kulipa", "Could not record payment"),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="flex-1 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Wallet className="h-3.5 w-3.5 mr-1.5" /> {t("Rekodi malipo", "Record payment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Lipa", "Pay")} {farmer.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("Salio la sasa", "Current balance")}</span>
            <span className="font-num font-bold">{tzs(farmer.currentBalanceTZS)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Njia", "Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Rejea", "Reference")}</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={pay.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {pay.isPending ? t("Inalipa…", "Paying…") : t("Lipa sasa", "Pay now")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestAdjustmentDialog({ farmer }: { farmer: Farmer }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const request = useRequestAdjustment();

  const save = () => {
    if (!delta || !reason.trim()) {
      toast.error(t("Weka kiasi na sababu", "Enter an amount and a reason"));
      return;
    }
    request.mutate(
      { farmerId: farmer.id, deltaTZS: delta, reason },
      {
        onSuccess: () => {
          toast.success(
            t(
              "Ombi limewasilishwa, linasubiri idhini ya admin",
              "Request submitted, awaiting admin approval",
            ),
          );
          setOpen(false);
          setDelta(0);
          setReason("");
        },
        onError: () => toast.error(t("Imeshindikana kuwasilisha", "Could not submit the request")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          {t("Omba marekebisho ya salio", "Request balance adjustment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Marekebisho ya salio la", "Balance adjustment for")} {farmer.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("Salio la sasa", "Current balance")}</span>
            <span className="font-num font-bold">{tzs(farmer.currentBalanceTZS)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>
              {t(
                "Kiasi (TZS, chanya kuongeza, hasi kupunguza)",
                "Amount (TZS, positive to add, negative to subtract)",
              )}
            </Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Sababu (lazima)", "Reason (required)")}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "Mfano: kurekebisha kosa la kuingiza litre",
                "e.g. correcting a litres entry mistake",
              )}
            />
          </div>
          <div className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
            {t(
              "Salio halitabadilika mpaka admin aidhinishe ombi hili.",
              "The balance does not change until an admin approves this request.",
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={request.isPending}>
            {request.isPending ? t("Inawasilisha…", "Submitting…") : t("Wasilisha", "Submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentsSection() {
  const { t, can } = useApp();
  const { data: adjustments = [] } = useFarmerAdjustments();
  const review = useReviewAdjustment();
  const isAdmin = can("users:write");
  if (adjustments.length === 0) return null;

  return (
    <div className="mt-5">
      <SectionCard
        title={t("Marekebisho ya salio (idhini ya admin)", "Balance adjustments (admin approval)")}
      >
        <ul className="divide-y divide-border">
          {adjustments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {a.farmerName ?? a.farmerId} ·{" "}
                  <span
                    className={`font-num font-semibold ${a.deltaTZS < 0 ? "text-[#E11B22]" : "text-[#1E7C3F]"}`}
                  >
                    {a.deltaTZS > 0 ? "+" : ""}
                    {tzs(a.deltaTZS)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.reason} · {t("Ameomba", "Requested by")} {a.requestedByName ?? "·"} ·{" "}
                  {new Date(a.requestedAt).toLocaleString()}
                  {a.reviewedByName &&
                    ` · ${t("Imekaguliwa na", "Reviewed by")} ${a.reviewedByName}`}
                </div>
              </div>
              <Pill
                tone={
                  a.status === "pending"
                    ? "warning"
                    : a.status === "approved"
                      ? "success"
                      : "danger"
                }
              >
                {a.status === "pending"
                  ? t("Inasubiri", "Pending")
                  : a.status === "approved"
                    ? t("Imeidhinishwa", "Approved")
                    : t("Imekataliwa", "Rejected")}
              </Pill>
              {isAdmin && a.status === "pending" && (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs text-white"
                    style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate(
                        { id: a.id, approve: true },
                        {
                          onSuccess: () =>
                            toast.success(
                              t("Imeidhinishwa, salio limebadilika", "Approved, balance updated"),
                            ),
                          onError: () => toast.error(t("Imeshindikana", "Could not approve")),
                        },
                      )
                    }
                  >
                    {t("Idhinisha", "Approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-[#E11B22] border-[#E11B22]"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate(
                        { id: a.id, approve: false },
                        {
                          onSuccess: () => toast.success(t("Imekataliwa", "Rejected")),
                          onError: () => toast.error(t("Imeshindikana", "Could not reject")),
                        },
                      )
                    }
                  >
                    {t("Kataa", "Reject")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-muted-foreground">
          {t(
            "Salio na malipo ya mwisho huendeshwa na makusanyo na malipo; marekebisho ya mkono yanahitaji idhini ya admin.",
            "Balance and last payment are driven by collections and payouts; manual corrections require admin approval.",
          )}
        </div>
      </SectionCard>
    </div>
  );
}
