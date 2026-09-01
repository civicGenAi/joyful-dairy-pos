import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data flows through src/lib/data/collections + locations. Points are
// locations rows (kind collection-point / plant), the same rows Settings edits,
// so changes here and there stay in sync automatically.
import { useCollections, useTransfers, useRecordTransfer } from "@/lib/data/hooks/collections";
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useSetLocationActive,
  useDeleteLocation,
} from "@/lib/data/hooks/locations";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { L, num } from "@/lib/format";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  MapPin,
  Users,
  Eye,
  ScrollText,
  Plus,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CollectionWithFarmer } from "@/lib/data/collections";
import type { Location } from "@/mock/data";

/** Where intake can happen: any collection point or the plant. */
function intakePoints(locations: Location[]): Location[] {
  return locations.filter((l) => l.kind === "collection-point" || l.kind === "plant");
}

export function CollectionPointsScreen() {
  const { t, lang, can } = useApp();
  const today = todayISO();
  const { data: collections = [], isPending } = useCollections(today);
  const { data: transfers = [] } = useTransfers();
  const { data: locations = [] } = useLocations();
  const [viewing, setViewing] = useState<Location | null>(null);

  const points = intakePoints(locations);
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const pointLabel = (l: Location) => (lang === "sw" ? l.swName : l.name);

  const intakeOf = (locationId: string) =>
    collections.filter((c) => c.locationId === locationId).reduce((a, c) => a + c.litres, 0);
  const farmersOf = (locationId: string) =>
    new Set(collections.filter((c) => c.locationId === locationId).map((c) => c.farmerId)).size;
  const totalToday = collections.reduce((a, c) => a + c.litres, 0);

  if (isPending) {
    return (
      <AppShell title={t("Pointi za ukusanyaji", "Collection points")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={5} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Pointi za ukusanyaji", "Collection points")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Jumla leo", "Total today")} value={L(totalToday)} accent="green" />
        <StatCard
          label={t("Pointi hai", "Active points")}
          value={num(points.filter((p) => p.active).length)}
          sub={t(`Zote ${points.length}`, `${points.length} in total`)}
          accent="info"
        />
        <StatCard
          label={t("Wafugaji leo", "Farmers today")}
          value={num(new Set(collections.map((c) => c.farmerId)).size)}
          accent="green"
        />
        <StatCard
          label={t("Wahamishaji", "Transfers")}
          value={num(transfers.length)}
          sub={t("Pointi → Plant → Van", "Point → Plant → Van")}
          accent="amber"
        />
      </div>

      {can("settings:write") && (
        <div className="mb-4 flex justify-end">
          <PointFormDialog
            trigger={
              <Button
                className="h-9 text-white"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("Ongeza pointi", "Add point")}
              </Button>
            }
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {points.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl overflow-hidden border border-border shadow-card bg-card ${p.active ? "" : "opacity-70"}`}
          >
            <div
              className="p-5 text-white"
              style={{
                background: p.active
                  ? "linear-gradient(135deg, #1E7C3F, #2F9E44 70%, #8CC63F)"
                  : "linear-gradient(135deg, #475569, #64748B)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
                  <MapPin className="h-3.5 w-3.5" />
                  {p.kind === "plant"
                    ? t("Kiwanda", "Plant")
                    : t("Point ya ukusanyaji", "Collection point")}
                </div>
                {!p.active && <Pill tone="slate">{t("Imesimamishwa", "Suspended")}</Pill>}
              </div>
              <div className="font-display text-2xl font-bold mt-1">{pointLabel(p)}</div>
              <div className="mt-3 font-num text-3xl font-bold">{L(intakeOf(p.id))}</div>
              <div className="text-xs opacity-85">
                {t("Yamekusanywa leo", "Collected today")} ·{" "}
                {t(`Wafugaji ${farmersOf(p.id)}`, `${farmersOf(p.id)} farmers`)}
              </div>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {can("transfer:write") && p.active && (
                <TransferDialog
                  fromLocationId={p.id}
                  fromName={pointLabel(p)}
                  locations={locations}
                />
              )}
              <Button variant="outline" className="rounded-xl" onClick={() => setViewing(p)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                {t("Tazama", "View log")}
              </Button>
              {can("settings:write") && <PointActions point={p} />}
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title={`${t("Matokeo ya leo, daftari", "Today's intake log")} (${today})`}
        action={<ScrollText className="h-4 w-4 text-muted-foreground" />}
      >
        {collections.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("Hakuna makusanyo bado leo", "No collections recorded today yet")}
            description={t(
              "Rekodi ukusanyaji kutoka skrini ya Wafugaji.",
              "Record collections from the Farmers screen.",
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Saa", "Time")}</th>
                  <th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th>
                  <th className="py-2 px-3">{t("Pointi", "Point")}</th>
                  <th className="py-2 px-3">{t("Kipindi", "Session")}</th>
                  <th className="py-2 px-3 text-right">{t("Litre", "Litres")}</th>
                </tr>
              </thead>
              <tbody>
                {collections.slice(0, 14).map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{c.farmerName ?? c.farmerId}</td>
                    <td className="py-2.5 px-3">
                      <Pill tone={c.locationId === "loc-main" ? "success" : "info"}>
                        {locationName(c.locationId ?? "")}
                      </Pill>
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {c.session === "morning" ? t("Asubuhi", "Morning") : t("Jioni", "Evening")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold">
                      {num(c.litres)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="mt-5">
        <SectionCard title={t("Uhamishaji wa hivi karibuni", "Recent transfers")}>
          {transfers.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title={t("Hakuna uhamishaji bado", "No transfers yet")}
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {transfers.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {locationName(tx.fromLocation)} → {locationName(tx.toLocation)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {tx.date}
                    </div>
                  </div>
                  <div className="font-num font-semibold">
                    {num(tx.qty)} {tx.unit}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {viewing && (
        <PointDetailDrawer
          point={viewing}
          collections={collections}
          today={today}
          onClose={() => setViewing(null)}
        />
      )}
    </AppShell>
  );
}

// ---- Point CRUD ------------------------------------------------------------

/** Add or edit a collection point. Writes to the shared locations table. */
function PointFormDialog({ point, trigger }: { point?: Location; trigger: React.ReactNode }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(point?.name ?? "");
  const [swName, setSwName] = useState(point?.swName ?? "");
  const [note, setNote] = useState(point?.note ?? "");
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const busy = create.isPending || update.isPending;

  const save = () => {
    if (!name.trim() || !swName.trim()) {
      toast.error(t("Jaza jina kwa lugha zote", "Fill in both names"));
      return;
    }
    const done = {
      onSuccess: () => {
        toast.success(
          point ? t("Pointi imehifadhiwa", "Point saved") : t("Pointi imeongezwa", "Point added"),
        );
        setOpen(false);
      },
      onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save the point")),
    };
    if (point) {
      update.mutate({ id: point.id, name: name.trim(), swName: swName.trim(), note }, done);
    } else {
      create.mutate(
        { name: name.trim(), swName: swName.trim(), kind: "collection-point", note },
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
          setName(point?.name ?? "");
          setSwName(point?.swName ?? "");
          setNote(point?.note ?? "");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {point
              ? t("Hariri pointi", "Edit point")
              : t("Ongeza pointi ya ukusanyaji", "Add collection point")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina (Kiingereza)", "Name (English)")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Point B, Ngarenaro"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Jina (Kiswahili)", "Name (Swahili)")}</Label>
            <Input
              value={swName}
              onChange={(e) => setSwName(e.target.value)}
              placeholder="Pointi B, Ngarenaro"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo (hiari)", "Notes (optional)")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
            {t(
              "Pointi hii itaonekana pia kwenye Mipangilio > Maeneo na kwenye fomu ya kurekodi ukusanyaji.",
              "This point also appears in Settings > Locations and in the record-collection form.",
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

function PointActions({ point }: { point: Location }) {
  const { t, lang } = useApp();
  const setActive = useSetLocationActive();
  const remove = useDeleteLocation();
  const label = lang === "sw" ? point.swName : point.name;

  return (
    <>
      <PointFormDialog
        point={point}
        trigger={
          <Button variant="outline" className="rounded-xl">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {t("Hariri", "Edit")}
          </Button>
        }
      />
      <ConfirmDialog
        title={
          point.active
            ? t("Simamisha pointi hii?", "Suspend this point?")
            : t("Rudisha pointi hii?", "Reactivate this point?")
        }
        description={
          point.active
            ? t(
                "Haitaonekana tena kwenye fomu ya kurekodi ukusanyaji hadi irudishwe.",
                "It will no longer appear in the record-collection form until reactivated.",
              )
            : t("Itaonekana tena kwenye fomu zote.", "It will appear in all forms again.")
        }
        confirmLabel={point.active ? t("Simamisha", "Suspend") : t("Rudisha", "Reactivate")}
        onConfirm={() =>
          setActive.mutate(
            { id: point.id, name: label, active: !point.active },
            {
              onSuccess: () =>
                toast.success(
                  point.active
                    ? t("Pointi imesimamishwa", "Point suspended")
                    : t("Pointi imerudishwa", "Point reactivated"),
                ),
              onError: () => toast.error(t("Imeshindikana", "Could not update the point")),
            },
          )
        }
        trigger={
          <Button variant="outline" className="rounded-xl">
            <Ban className="h-3.5 w-3.5 mr-1.5" />
            {point.active ? t("Simamisha", "Suspend") : t("Rudisha", "Reactivate")}
          </Button>
        }
      />
      <ConfirmDialog
        destructive
        title={t("Futa pointi hii?", "Delete this point?")}
        description={t(
          "Inafutwa kabisa. Pointi yenye historia ya makusanyo haiwezi kufutwa; isimamishe badala yake.",
          "This is permanent. A point with collection history cannot be deleted; suspend it instead.",
        )}
        confirmLabel={t("Futa", "Delete")}
        onConfirm={() =>
          remove.mutate(
            { id: point.id, name: label },
            {
              onSuccess: () => toast.success(t("Pointi imefutwa", "Point deleted")),
              onError: () =>
                toast.error(
                  t(
                    "Imeshindikana: pointi ina historia, isimamishe badala yake",
                    "Could not delete: the point has history, suspend it instead",
                  ),
                ),
            },
          )
        }
        trigger={
          <Button variant="ghost" className="rounded-xl text-[#E11B22]">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t("Futa", "Delete")}
          </Button>
        }
      />
    </>
  );
}

// ---- Detail drawer ----------------------------------------------------------

function PointDetailDrawer({
  point,
  collections,
  today,
  onClose,
}: {
  point: Location;
  collections: CollectionWithFarmer[];
  today: string;
  onClose: () => void;
}) {
  const { t, lang } = useApp();
  const rows = useMemo(
    () => collections.filter((c) => c.locationId === point.id),
    [collections, point.id],
  );
  const total = rows.reduce((a, c) => a + c.litres, 0);
  const morning = rows.filter((r) => r.session === "morning").reduce((a, r) => a + r.litres, 0);
  const evening = rows.filter((r) => r.session === "evening").reduce((a, r) => a + r.litres, 0);
  const uniqueFarmers = new Set(rows.map((r) => r.farmerId)).size;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-2xl text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <div>{lang === "sw" ? point.swName : point.name}</div>
              <div className="text-xs text-muted-foreground font-normal">{today}</div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-5 grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Jumla", "Total")}
            </div>
            <div className="font-num font-bold">{L(total)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Asubuhi", "Morning")}
            </div>
            <div className="font-num font-bold">{L(morning)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Jioni", "Evening")}
            </div>
            <div className="font-num font-bold">{L(evening)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Wafugaji", "Farmers")}
            </div>
            <div className="font-num font-bold flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {uniqueFarmers}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-xs font-semibold mb-2">{t("Daftari kamili", "Full intake log")}</div>
          {rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("Hakuna makusanyo leo kwenye pointi hii", "No collections at this point today")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2">{t("Mfugaji", "Farmer")}</th>
                  <th>{t("Kipindi", "Session")}</th>
                  <th className="text-right">{t("Litre", "Litres")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{r.farmerName ?? r.farmerId}</td>
                    <td className="py-2 text-xs">
                      {r.session === "morning" ? t("Asubuhi", "Morning") : t("Jioni", "Evening")}
                    </td>
                    <td className="py-2 text-right font-num font-semibold">{num(r.litres)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Transfers ---------------------------------------------------------------

function TransferDialog({
  fromLocationId,
  fromName,
  locations,
}: {
  fromLocationId: string;
  fromName: string;
  locations: Location[];
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const destinations = locations.filter(
    (l) => l.active && (l.kind === "plant" || l.kind === "van") && l.id !== fromLocationId,
  );
  const [to, setTo] = useState(destinations[0]?.id ?? "");
  const [litres, setLitres] = useState(120);
  const record = useRecordTransfer();

  const save = () => {
    if (litres <= 0 || !to) return;
    record.mutate(
      // Milk moves as the raw-milk stock item between locations.
      { fromLocation: fromLocationId, toLocation: to, stockItemId: "raw-milk", qty: litres },
      {
        onSuccess: () => {
          toast.success(t("Uhamishaji umehifadhiwa", "Transfer saved"));
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kuhamisha", "Could not save transfer")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
          {t("Hamisha maziwa", "Transfer milk")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Hamisha maziwa", "Transfer milk")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Kutoka", "From")}</Label>
            <Input defaultValue={fromName} readOnly />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Kwenda", "To")}</Label>
            <Select value={to || destinations[0]?.id} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <Button onClick={save} disabled={record.isPending}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
