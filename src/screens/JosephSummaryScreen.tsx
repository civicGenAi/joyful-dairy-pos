import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: Joseph's own sales and deposits (src/lib/data/joseph). A
// separate salesperson with his own book: milk sold at one of five fixed
// rates, banked by M-Pesa or bank apart from the main deposits log. Kept
// standalone on purpose, the same way the M-Pesa daily book is, so his
// numbers are visible on their own rather than folded into totals they do
// not belong in.
import {
  useJosephRates,
  useJosephDailySummary,
  useJosephRateBreakdown,
  useJosephDeposits,
  useRecordJosephDay,
  useRecordJosephDeposit,
  useUpdateJosephDeposit,
  useDeleteJosephDeposit,
} from "@/lib/data/hooks/joseph";
import type { JosephDeposit } from "@/lib/data/joseph";
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
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ChevronLeft, ChevronRight, Plus, Wallet, Smartphone, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function startOfWeek(dateStr: string): Date {
  const dt = new Date(`${dateStr}T00:00:00`);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}
function toISO(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

type Grain = "day" | "week" | "month" | "year";

export function JosephSummaryScreen() {
  const { t, lang } = useApp();
  const today = todayISO();

  const [grain, setGrain] = useState<Grain>("month");
  const [anchor, setAnchor] = useState(today);
  const [y, m, d] = anchor.split("-").map(Number);

  const range = (() => {
    if (grain === "day") return { from: anchor, to: anchor };
    if (grain === "week") {
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: toISO(start), to: toISO(end) };
    }
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
    else if (grain === "week") dt.setDate(dt.getDate() + delta * 7);
    else if (grain === "month") dt.setMonth(dt.getMonth() + delta);
    else dt.setFullYear(dt.getFullYear() + delta);
    setAnchor(toISO(dt));
  };

  const windowLabel = (() => {
    if (grain === "day") {
      return new Date(`${anchor}T00:00:00`).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (grain === "week") {
      const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
      const locale = lang === "sw" ? "sw-TZ" : "en-GB";
      const start = new Date(`${range.from}T00:00:00`).toLocaleDateString(locale, opts);
      const end = new Date(`${range.to}T00:00:00`).toLocaleDateString(locale, {
        ...opts,
        year: "numeric",
      });
      return `${start} – ${end}`;
    }
    if (grain === "month") {
      return new Date(`${anchor.slice(0, 7)}-01T00:00:00`).toLocaleDateString(
        lang === "sw" ? "sw-TZ" : "en-GB",
        { month: "long", year: "numeric" },
      );
    }
    return String(y);
  })();

  const atLatest = grain === "year" ? y >= Number(today.slice(0, 4)) : anchor >= today;

  const { data: rates = [] } = useJosephRates();
  const { data: days = [], isPending } = useJosephDailySummary(range.from, range.to);
  const { data: breakdown = [] } = useJosephRateBreakdown(range.from, range.to);
  const { data: deposits = [] } = useJosephDeposits(range.from, range.to);

  const totalLitres = days.reduce((a, x) => a + x.litres, 0);
  const totalRevenue = days.reduce((a, x) => a + x.revenueTZS, 0);
  const totalDeposited = days.reduce((a, x) => a + x.depositedTZS, 0);
  const totalDifference = totalRevenue - totalDeposited;

  return (
    <AppShell title={t("Muhtasari wa Joseph", "Joseph summary")}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month", "year"] as const).map((g) => (
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
                  : g === "week"
                    ? t("Wiki", "Week")
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
        <div className="flex items-center gap-2">
          <ExportMenu
            formats={["csv", "excel", "pdf"]}
            filename={`joseph-${range.from}-to-${range.to}`}
            data={() => ({
              title: t(`Muhtasari wa Joseph, ${windowLabel}`, `Joseph summary, ${windowLabel}`),
              headers: ["Date", "Litres", "Revenue", "M-Pesa", "Bank", "Deposited", "Difference"],
              rows: days.map((x) => [
                x.date,
                x.litres,
                x.revenueTZS,
                x.mpesaTZS,
                x.bankTZS,
                x.depositedTZS,
                x.differenceTZS,
              ]),
            })}
          />
          <RecordJosephDaySheet rates={rates} />
        </div>
      </div>

      {isPending ? (
        <SectionSkeleton>
          <TableSkeleton rows={8} cols={6} />
        </SectionSkeleton>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label={t("Lita zote", "Total litres")} value={L(totalLitres)} accent="info" />
            <StatCard
              label={t("Mauzo (kwa bei)", "Revenue (at rate)")}
              value={tzs(totalRevenue)}
              accent="green"
            />
            <StatCard
              label={t("Kiasi kilichowekwa", "Deposited")}
              value={tzs(totalDeposited)}
              accent="amber"
            />
            <StatCard
              label={t("Tofauti", "Difference")}
              value={tzs(totalDifference)}
              sub={
                Math.abs(totalDifference) < 1
                  ? t("Inalingana", "Matches")
                  : t("Chunguza", "Worth checking")
              }
              accent={Math.abs(totalDifference) < 1 ? "green" : "red"}
            />
          </div>

          {/* Litres and revenue at each rate, over whatever window is
              selected: the exact "how much at 1700, how much at 1600" view. */}
          <SectionCard title={t("Kwa kila bei", "By rate")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Bei kwa lita", "Rate per litre")}</th>
                    <th className="text-right">{t("Lita", "Litres")}</th>
                    <th className="text-right px-3">{t("Mauzo", "Revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r) => (
                    <tr
                      key={r.rateTZS}
                      className={`border-b border-border last:border-0 ${r.litres === 0 ? "opacity-45" : ""}`}
                    >
                      <td className="py-2.5 px-3 font-num font-medium">{tzs(r.rateTZS, false)}</td>
                      <td className="py-2.5 text-right font-num">
                        {r.litres > 0 ? num(r.litres) : ""}
                      </td>
                      <td className="py-2.5 text-right px-3 font-num font-semibold">
                        {r.revenueTZS > 0 ? tzs(r.revenueTZS, false) : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                    <td className="py-3 px-3 font-bold">{t("Jumla", "Total")}</td>
                    <td className="py-3 text-right font-num font-bold">{num(totalLitres)}</td>
                    <td className="py-3 text-right px-3 font-num font-bold text-base">
                      {tzs(totalRevenue, false)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Day by day, so a longer window can still answer a question
              about one date, and the difference is visible per day. */}
          <SectionCard title={t("Kila siku", "Day by day")}>
            {days.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={t("Hakuna kumbukumbu bado", "No records in this period")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                      <th className="text-right">{t("Lita", "Litres")}</th>
                      <th className="text-right">{t("Mauzo", "Revenue")}</th>
                      <th className="text-right">M-Pesa</th>
                      <th className="text-right">{t("Benki", "Bank")}</th>
                      <th className="text-right">{t("Kilichowekwa", "Deposited")}</th>
                      <th className="text-right px-3">{t("Tofauti", "Difference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((x) => (
                      <tr key={x.date} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-num text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setGrain("day");
                              setAnchor(x.date);
                            }}
                            className="hover:underline"
                          >
                            {x.date}
                          </button>
                        </td>
                        <td className="py-2.5 text-right font-num">{num(x.litres)}</td>
                        <td className="py-2.5 text-right font-num font-semibold">
                          {tzs(x.revenueTZS, false)}
                        </td>
                        <td className="py-2.5 text-right font-num">
                          {x.mpesaTZS > 0 ? tzs(x.mpesaTZS, false) : ""}
                        </td>
                        <td className="py-2.5 text-right font-num">
                          {x.bankTZS > 0 ? tzs(x.bankTZS, false) : ""}
                        </td>
                        <td className="py-2.5 text-right font-num">{tzs(x.depositedTZS, false)}</td>
                        <td
                          className="py-2.5 text-right px-3 font-num font-semibold"
                          style={Math.abs(x.differenceTZS) >= 1 ? { color: "#E11B22" } : undefined}
                        >
                          {tzs(x.differenceTZS, false)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                      <td className="py-3 px-3 font-bold">{t("Jumla", "Total")}</td>
                      <td className="py-3 text-right font-num font-bold">{num(totalLitres)}</td>
                      <td className="py-3 text-right font-num font-bold">
                        {tzs(totalRevenue, false)}
                      </td>
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
                      <td className="py-3 text-right font-num font-bold">
                        {tzs(totalDeposited, false)}
                      </td>
                      <td className="py-3 text-right px-3 font-num font-bold">
                        {tzs(totalDifference, false)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-[11px] text-muted-foreground">
              {t(
                "Tofauti ni mauzo (kwa bei aliyouza) kasoro kilichowekwa benki au M-Pesa. Si hitilafu, ni kitu cha kuangalia.",
                "Difference is revenue at the rate sold, less what was actually banked. Not an error, something worth checking.",
              )}
            </div>
          </SectionCard>

          <SectionCard title={t("Amana za Joseph", "Joseph's deposits")}>
            {deposits.length === 0 ? (
              <EmptyState title={t("Hakuna amana", "No deposits in this period")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                      <th>{t("Njia", "Channel")}</th>
                      <th className="text-right">{t("Kiasi", "Amount")}</th>
                      <th className="px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((dep) => (
                      <tr key={dep.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                          {dep.date}
                        </td>
                        <td className="py-2.5">
                          <Pill tone="info">
                            <span className="inline-flex items-center gap-1">
                              {dep.channel === "mpesa" ? (
                                <Smartphone className="h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3" />
                              )}
                              {dep.channel}
                            </span>
                          </Pill>
                        </td>
                        <td className="py-2.5 text-right font-num font-semibold">
                          {tzs(dep.amountTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <EditJosephDepositSheet deposit={dep} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}

// One form for a whole day: litres across every rate, and what was
// actually deposited (amount typed in by hand, not the figure the rates
// imply) plus the channel it came through. A rate left blank or at zero
// clears that rate's row for the day; leaving litres blank entirely (only
// filling in the deposit) leaves that day's sales untouched rather than
// wiping them.
function RecordJosephDaySheet({ rates }: { rates: number[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Record<number, number>>({});
  const [amount, setAmount] = useState<number | "">("");
  const [channel, setChannel] = useState<"mpesa" | "bank">("mpesa");
  const recordDay = useRecordJosephDay();
  const recordDeposit = useRecordJosephDeposit();

  const total = Object.values(values).reduce((a, v) => a + (v || 0), 0);
  const impliedRevenue = rates.reduce((a, r) => a + (values[r] ?? 0) * r, 0);
  const hasDeposit = amount !== "" && Number(amount) > 0;
  const canSave = total > 0 || hasDeposit;
  const saving = recordDay.isPending || recordDeposit.isPending;

  const reset = () => {
    setOpen(false);
    setValues({});
    setAmount("");
  };

  const finish = () => {
    if (!hasDeposit) {
      toast.success(t("Imerekodiwa", "Recorded"));
      reset();
      return;
    }
    recordDeposit.mutate(
      { date, amountTZS: Number(amount), channel },
      {
        onSuccess: () => {
          toast.success(t("Imerekodiwa", "Recorded"));
          reset();
        },
        onError: () => toast.error(t("Amana haikuhifadhiwa", "The deposit could not be saved")),
      },
    );
  };

  const save = () => {
    if (!canSave) return;
    if (total > 0) {
      recordDay.mutate(
        { date, rates: rates.map((r) => ({ rateTZS: r, litres: values[r] ?? 0 })) },
        {
          onSuccess: finish,
          onError: (e: Error) =>
            toast.error(
              e.message.includes("future-date")
                ? t("Huwezi kurekodi tarehe ijayo", "You cannot record a future date")
                : t("Imeshindikana kurekodi", "Could not record it"),
            ),
        },
      );
    } else {
      finish();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Mauzo ya siku", "Day's sales")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekodi siku ya Joseph", "Record Joseph's day")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
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
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("Lita kwa kila bei", "Litres at each rate")}
            </Label>
            <div className="grid gap-2">
              {rates.map((r) => (
                <div key={r} className="grid grid-cols-[110px_1fr] gap-3 items-center">
                  <Label className="text-xs font-num">{tzs(r, false)}/L</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    value={values[r] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [r]: Number(e.target.value) || 0 }))}
                    className="font-num"
                  />
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="rounded-xl bg-secondary/60 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t(`Jumla ya lita ${num(total)}`, `Total ${num(total)} L`)}</span>
                <span>
                  {t("Mauzo kwa bei", "At the rates sold, that is")}{" "}
                  <span className="font-num">{tzs(impliedRevenue, false)}</span>
                </span>
              </div>
            )}
          </div>
          <div className="grid gap-1.5 pt-1 border-t border-border">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mt-2">
              {t("Amana ya siku", "Deposit for the day")}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  {t("Kiasi (TZS)", "Amount (TZS)")}{" "}
                  <span className="text-muted-foreground normal-case font-normal">
                    {t("(si lazima, andika mwenyewe)", "(optional, type it in)")}
                  </span>
                </Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  placeholder={t("Kiasi halisi", "Actual amount")}
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
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EditJosephDepositSheet({ deposit }: { deposit: JosephDeposit }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(deposit.date);
  const [amount, setAmount] = useState<number>(deposit.amountTZS);
  const [channel, setChannel] = useState<"mpesa" | "bank">(deposit.channel);
  const update = useUpdateJosephDeposit();
  const remove = useDeleteJosephDeposit();

  const changed =
    date !== deposit.date || amount !== deposit.amountTZS || channel !== deposit.channel;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          {t("Hariri", "Edit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekebisha amana", "Correct this deposit")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="font-num"
              />
            </div>
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
        <SheetFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <ConfirmDialog
            destructive
            title={t("Futa amana hii?", "Remove this deposit?")}
            description={t("Haiwezi kurudishwa.", "This cannot be undone.")}
            confirmLabel={t("Futa", "Remove")}
            onConfirm={() =>
              remove.mutate(deposit.id, {
                onSuccess: () => {
                  toast.success(t("Imefutwa", "Removed"));
                  setOpen(false);
                },
                onError: () => toast.error(t("Imeshindikana", "Could not remove it")),
              })
            }
            trigger={
              <Button variant="outline" className="text-[#E11B22] border-[#E11B22]/40">
                {t("Futa", "Remove")}
              </Button>
            }
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("Ghairi", "Cancel")}
            </Button>
            <Button
              disabled={!changed || amount <= 0 || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: deposit.id, date, amountTZS: amount, channel },
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
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
