import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: the daily M-Pesa sales book (src/lib/data/mpesaDaily). Milk goes
// out over M-Pesa all day in ones and twos and nobody rings each one into
// the counter, so what is written down is litres and money, once, for the
// day. Kept as its own page rather than a tab inside Sales deposits: it is
// a different kind of record (a sale that happened, not money banked) and
// was easy to miss tucked inside another screen.
import {
  useMpesaDaily,
  useRecordMpesaDay,
  useUpdateMpesaDay,
  useDeleteMpesaDay,
} from "@/lib/data/hooks/mpesaDaily";
import type { MpesaEntry } from "@/lib/data/mpesaDaily";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { tzs, num, L } from "@/lib/format";
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
import { ChevronLeft, ChevronRight, Smartphone, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MpesaSalesScreen() {
  const { t, lang, can } = useApp();
  const canWrite = can("pos:use") || can("finance:write");
  const today = todayISO();

  // Same day/month/year window pattern as Sales deposits, so the two
  // screens read the same way even though they are separate pages.
  const [grain, setGrain] = useState<"day" | "month" | "year">("month");
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

  const { data, isPending } = useMpesaDaily(range.from, range.to);
  const record = useRecordMpesaDay();
  const remove = useDeleteMpesaDay();

  const [date, setDate] = useState(today);
  const [litres, setLitres] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");
  const [channel, setChannel] = useState<"mpesa" | "bank">("mpesa");

  const days = data?.summary ?? [];
  const entries = data?.entries ?? [];
  const totalL = days.reduce((a, x) => a + x.litres, 0);
  const totalTZS = days.reduce((a, x) => a + x.amountTZS, 0);
  const avg = totalL > 0 ? totalTZS / totalL : 0;
  // Litres is the one thing that has to be known to save at all. Money is
  // often not known yet, and gets filled in later by editing the entry.
  const ready = litres !== "" && Number(litres) > 0;

  const add = () => {
    if (!ready) return;
    record.mutate(
      {
        date,
        litres: Number(litres),
        amountTZS: amount === "" ? undefined : Number(amount),
        channel,
      },
      {
        onSuccess: () => {
          toast.success(t("Imerekodiwa", "Recorded"));
          setLitres("");
          setAmount("");
        },
        onError: (e: Error) =>
          toast.error(
            e.message.includes("future-date")
              ? t("Huwezi kurekodi tarehe ijayo", "You cannot record a future date")
              : t("Imeshindikana kurekodi", "Could not record it"),
          ),
      },
    );
  };

  return (
    <AppShell title={t("Mauzo ya M-Pesa", "M-Pesa sales")}>
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
            <span className="text-sm font-semibold min-w-[9rem] text-center">{windowLabel}</span>
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
      </div>

      {isPending ? (
        <SectionSkeleton>
          <TableSkeleton rows={6} cols={4} />
        </SectionSkeleton>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label={t("Lita zilizouzwa", "Litres sold")} value={L(totalL)} accent="info" />
            <StatCard label={t("Fedha", "Money in")} value={tzs(totalTZS)} accent="green" />
            <StatCard
              label={t("Wastani kwa lita", "Average per litre")}
              value={tzs(avg)}
              sub={windowLabel}
              accent="amber"
            />
          </div>

          {canWrite && (
            <SectionCard title={t("Rekodi mauzo ya M-Pesa ya siku", "Record a day's M-Pesa sales")}>
              <div className="grid sm:grid-cols-5 gap-3 items-end">
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t("Tarehe", "Date")}</Label>
                  <Input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t("Lita", "Litres")}</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={litres}
                    onChange={(e) => setLitres(e.target.value === "" ? "" : Number(e.target.value))}
                    className="font-num"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    {t("Fedha (TZS)", "Money (TZS)")}{" "}
                    <span className="text-muted-foreground normal-case font-normal">
                      {t("(si lazima)", "(optional)")}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder={t("Jaza baadaye ukipenda", "Fill in later if you like")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="font-num"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">{t("Njia", "Channel")}</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank">{t("Benki", "Bank")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={add}
                  disabled={!ready || record.isPending}
                  className="text-white"
                  style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                >
                  {record.isPending ? t("Inahifadhi…", "Saving…") : t("Ongeza", "Add")}
                </Button>
              </div>
              {ready && amount !== "" && Number(amount) > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {t("Hii ni", "That works out at")}{" "}
                  <span className="font-num font-semibold">
                    {tzs(Number(amount) / Number(litres))}
                  </span>{" "}
                  {t("kwa lita", "per litre")}
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard title={t("Kila siku", "Day by day")}>
            {days.length === 0 ? (
              <EmptyState
                icon={Smartphone}
                title={t("Hakuna mauzo ya M-Pesa", "No M-Pesa sales in this period")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                      <th className="text-right">{t("Lita", "Litres")}</th>
                      <th className="text-right">M-Pesa</th>
                      <th className="text-right">{t("Benki", "Bank")}</th>
                      <th className="text-right">{t("Fedha", "Money")}</th>
                      <th className="text-right px-3">{t("Kwa lita", "Per litre")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((x) => (
                      <tr key={x.date} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-num text-xs">
                          {x.date}
                          {x.entries > 1 && (
                            <span className="ml-2 text-muted-foreground">
                              {x.entries} {t("mara", "entries")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-num">{num(x.litres)}</td>
                        <td className="py-2.5 text-right font-num">
                          {x.mpesaTZS > 0 ? tzs(x.mpesaTZS, false) : ""}
                        </td>
                        <td className="py-2.5 text-right font-num">
                          {x.bankTZS > 0 ? tzs(x.bankTZS, false) : ""}
                        </td>
                        <td className="py-2.5 text-right font-num font-semibold">
                          {x.amountTZS > 0 ? (
                            tzs(x.amountTZS, false)
                          ) : (
                            <span className="text-muted-foreground font-normal">
                              {t("Bado", "Not yet")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right px-3 font-num text-muted-foreground">
                          {x.amountTZS > 0 ? tzs(x.perLitre, false) : ""}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                      <td className="py-3 px-3 font-bold">{t("Jumla", "Total")}</td>
                      <td className="py-3 text-right font-num font-bold">{num(totalL)}</td>
                      <td className="py-3 text-right font-num font-bold">
                        {tzs(
                          days.reduce((a, x) => a + x.mpesaTZS, 0),
                          false,
                        )}
                      </td>
                      <td className="py-3 text-right font-num font-bold">
                        {tzs(
                          days.reduce((a, x) => a + x.bankTZS, 0),
                          false,
                        )}
                      </td>
                      <td className="py-3 text-right font-num font-bold">{tzs(totalTZS, false)}</td>
                      <td className="py-3 text-right px-3 font-num font-bold">{tzs(avg, false)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {canWrite && entries.length > 0 && (
            <SectionCard title={t("Rekodi moja moja", "Individual entries")}>
              <ul className="divide-y divide-border text-sm">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="font-num text-xs text-muted-foreground w-24">{e.date}</span>
                    <span className="flex-1 flex items-center gap-2 font-num flex-wrap">
                      {num(e.litres)} L ·{" "}
                      {e.amountTZS > 0 ? (
                        tzs(e.amountTZS)
                      ) : (
                        <span className="text-muted-foreground font-normal">
                          {t("fedha bado", "money not yet recorded")}
                        </span>
                      )}
                      <Pill tone="info">
                        <span className="inline-flex items-center gap-1">
                          {e.channel === "mpesa" ? (
                            <Smartphone className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {e.channel}
                        </span>
                      </Pill>
                      {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
                    </span>
                    <EditMpesaEntrySheet entry={e} />
                    <ConfirmDialog
                      destructive
                      title={t("Futa rekodi hii?", "Remove this entry?")}
                      description={t(
                        "Itaondolewa kwenye jumla za siku hiyo.",
                        "It comes out of that day's totals.",
                      )}
                      confirmLabel={t("Futa", "Remove")}
                      onConfirm={() =>
                        remove.mutate(e.id, {
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
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
}

// Litres is usually recorded before the money is known. This is the way
// back in to fill it in, correct it, or move it to the right channel,
// without having to delete and re-add the whole entry.
function EditMpesaEntrySheet({ entry }: { entry: MpesaEntry }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(entry.date);
  const [litres, setLitres] = useState<number>(entry.litres);
  const [amount, setAmount] = useState<number>(entry.amountTZS);
  const [channel, setChannel] = useState<"mpesa" | "bank">(entry.channel);
  const update = useUpdateMpesaDay();

  const changed =
    date !== entry.date ||
    litres !== entry.litres ||
    amount !== entry.amountTZS ||
    channel !== entry.channel;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          {t("Hariri", "Edit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekebisha mauzo ya M-Pesa", "Correct this M-Pesa entry")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Lita", "Litres")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={litres}
                onChange={(e) => setLitres(Number(e.target.value))}
                className="font-num"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Fedha (TZS)", "Money (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="font-num"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Njia", "Channel")}</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">{t("Benki", "Bank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            disabled={!changed || litres <= 0 || update.isPending}
            onClick={() =>
              update.mutate(
                { id: entry.id, date, litres, amountTZS: amount, channel },
                {
                  onSuccess: () => {
                    toast.success(t("Imerekebishwa", "Corrected"));
                    setOpen(false);
                  },
                  onError: () => toast.error(t("Imeshindikana", "Could not save the change")),
                },
              )
            }
          >
            {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
