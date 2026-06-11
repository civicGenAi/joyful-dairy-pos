import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/collections + locations (was @/mock/data).
import { useCollections, useTransfers, useRecordTransfer } from "@/lib/data/hooks/collections";
import { useLocations } from "@/lib/data/hooks/locations";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
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
import { ArrowRightLeft, MapPin, Users, Eye, ScrollText } from "lucide-react";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CollectionWithFarmer } from "@/lib/data/collections";
import type { Location } from "@/mock/data";

export function CollectionPointsScreen() {
  const { t } = useApp();
  const today = todayISO();
  const { data: collections = [], isPending } = useCollections(today);
  const { data: transfers = [] } = useTransfers();
  const { data: locations = [] } = useLocations();
  const [viewing, setViewing] = useState<null | "field-a" | "main">(null);

  const pointA = collections.filter((c) => c.point === "field-a").reduce((a, c) => a + c.litres, 0);
  const main = collections.filter((c) => c.point === "main").reduce((a, c) => a + c.litres, 0);
  const farmersAtA = new Set(
    collections.filter((c) => c.point === "field-a").map((c) => c.farmerId),
  ).size;
  const farmersAtMain = new Set(
    collections.filter((c) => c.point === "main").map((c) => c.farmerId),
  ).size;
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

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
        <StatCard
          label={t("Point A, Shambani", "Point A, Field")}
          value={L(pointA)}
          sub={t(`Wafugaji ${farmersAtA} leo`, `${farmersAtA} farmers today`)}
          accent="green"
        />
        <StatCard
          label={t("Main, Kiwandani", "Main, Plant")}
          value={L(main)}
          sub={t(`Wafugaji ${farmersAtMain} leo`, `${farmersAtMain} farmers today`)}
          accent="info"
        />
        <StatCard label={t("Jumla leo", "Total today")} value={L(pointA + main)} accent="green" />
        <StatCard
          label={t("Wahamishaji", "Transfers")}
          value={num(transfers.length)}
          sub={t("Pointi → Plant → Van", "Point → Plant → Van")}
          accent="amber"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {[
          {
            id: "field-a" as const,
            locationId: "loc-field-a",
            name: "Point A, Olasiti",
            intake: pointA,
          },
          {
            id: "main" as const,
            locationId: "loc-main",
            name: "Main plant, Arusha",
            intake: main,
          },
        ].map((p) => (
          <div
            key={p.id}
            className="rounded-2xl overflow-hidden border border-border shadow-card bg-card"
          >
            <div
              className="p-5 text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #2F9E44 70%, #8CC63F)" }}
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
                <MapPin className="h-3.5 w-3.5" /> {t("Point ya ukusanyaji", "Collection point")}
              </div>
              <div className="font-display text-2xl font-bold mt-1">{p.name}</div>
              <div className="mt-3 font-num text-3xl font-bold">{L(p.intake)}</div>
              <div className="text-xs opacity-85">{t("Yamekusanywa leo", "Collected today")}</div>
            </div>
            <div className="p-4 flex gap-2">
              <TransferDialog
                fromLocationId={p.locationId}
                fromName={p.name}
                locations={locations}
              />
              <Button variant="outline" className="rounded-xl" onClick={() => setViewing(p.id)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                {t("Tazama matokeo", "View intake log")}
              </Button>
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
                        : c.session === "morning"
                          ? "06:30"
                          : "17:10"}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{c.farmerName ?? c.farmerId}</td>
                    <td className="py-2.5 px-3">
                      <Pill tone={c.point === "field-a" ? "info" : "success"}>
                        {c.point === "field-a" ? "Point A" : "Main"}
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

function PointDetailDrawer({
  point,
  collections,
  today,
  onClose,
}: {
  point: "field-a" | "main";
  collections: CollectionWithFarmer[];
  today: string;
  onClose: () => void;
}) {
  const { t } = useApp();
  const rows = useMemo(() => collections.filter((c) => c.point === point), [collections, point]);
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
              <div>{point === "field-a" ? "Point A, Olasiti" : "Main plant, Arusha"}</div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  const [to, setTo] = useState(fromLocationId === "loc-main" ? "loc-van1" : "loc-main");
  const [litres, setLitres] = useState(120);
  const record = useRecordTransfer();
  const destinations = locations.filter(
    (l) => (l.kind === "plant" || l.kind === "van") && l.id !== fromLocationId,
  );

  const save = () => {
    if (litres <= 0) return;
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
            <Select value={to} onValueChange={setTo}>
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
