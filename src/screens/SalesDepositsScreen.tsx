import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: sales deposits reuse the same deposits table/RPC as the generic
// Deposits & receipts log in Finance, scoped to sales_deposit_categories
// sources instead of the fixed customer/route/pos/other ones.
import {
  useDepositsByRange,
  useSalesDepositCategories,
  useCreateSalesDepositCategory,
  useRecordDeposit,
  useUpdateDeposit,
  useDeleteDeposit,
} from "@/lib/data/hooks/sales";
import { SOURCE_LABEL } from "@/lib/data/sales";
import type { DepositRecord } from "@/lib/data/sales";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { todayISO } from "@/lib/data/dates";
import { uploadHardCopy } from "@/lib/data/uploads";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs } from "@/lib/format";
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
import {
  Plus,
  Receipt,
  Smartphone,
  ArrowUpRight,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMpesaDaily, useRecordMpesaDay, useDeleteMpesaDay } from "@/lib/data/hooks/mpesaDaily";
import { num, L } from "@/lib/format";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftNotice } from "@/components/ui/DraftNotice";

// Banking real sales revenue (by product, and by outlet like Shambani or
// Masoko) month by month. Amounts are typed in by hand: POS and route
// sales don't record which outlet a sale happened at yet, so they can't
// be split out from real data.
export function SalesDepositsScreen() {
  const { t, lang, can } = useApp();
  const canDeposit = can("deposit:write");
  const today = todayISO();

  // Day, month or year. The same rows and the same totals throughout, so
  // moving between them is a change of window rather than a change of
  // shape: whatever you learn to read once reads the same everywhere.
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

  const { data: categories = [] } = useSalesDepositCategories();
  const { data: rows = [], isPending } = useDepositsByRange(range.from, range.to);

  const deposits = rows
    .filter((r) => categories.includes(r.source))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const label = (c: string) => t(SOURCE_LABEL[c]?.sw ?? c, SOURCE_LABEL[c]?.en ?? c);

  // One row per product or outlet, which is the question actually being
  // asked: how much did mtindi bring in, this month, compared with the
  // rest. Split by channel too, since that is the other thing people
  // check, and kept in one table rather than scattered across cards.
  const byCategory = categories
    .map((cat) => {
      const mine = deposits.filter((x) => x.source === cat);
      return {
        category: cat,
        count: mine.length,
        mpesa: mine.filter((x) => x.method === "mpesa").reduce((a, x) => a + x.amountTZS, 0),
        bank: mine.filter((x) => x.method === "bank").reduce((a, x) => a + x.amountTZS, 0),
        cash: mine.filter((x) => x.method === "cash").reduce((a, x) => a + x.amountTZS, 0),
        total: mine.reduce((a, x) => a + x.amountTZS, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  const grand = byCategory.reduce(
    (a, r) => ({
      mpesa: a.mpesa + r.mpesa,
      bank: a.bank + r.bank,
      cash: a.cash + r.cash,
      total: a.total + r.total,
      count: a.count + r.count,
    }),
    { mpesa: 0, bank: 0, cash: 0, total: 0, count: 0 },
  );

  // Within the window, the same figures broken down by day, so a month
  // view can still answer "what came in on the 14th" without switching.
  const byDay = Object.entries(
    deposits.reduce<Record<string, Record<string, number>>>((acc, x) => {
      (acc[x.date] ??= {})[x.source] = (acc[x.date]?.[x.source] ?? 0) + x.amountTZS;
      (acc[x.date] ??= {}).__total = (acc[x.date]?.__total ?? 0) + x.amountTZS;
      return acc;
    }, {}),
  ).sort((a, b) => (a[0] < b[0] ? 1 : -1));

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

  return (
    <AppShell title={t("Amana za mauzo", "Sales deposits")}>
      <Tabs defaultValue="deposits">
        <TabsList className="mb-4">
          <TabsTrigger value="deposits">{t("Amana kwa bidhaa", "Deposits by product")}</TabsTrigger>
          <TabsTrigger value="mpesa">{t("Mauzo ya M-Pesa", "M-Pesa sales")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mpesa">
          <MpesaDailyTab from={range.from} to={range.to} windowLabel={windowLabel} />
        </TabsContent>

        <TabsContent value="deposits">
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
                <span className="text-sm font-semibold min-w-[9rem] text-center">
                  {windowLabel}
                </span>
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
                filename={`sales-deposits-${range.from}-to-${range.to}`}
                data={() => ({
                  title: t(`Amana za mauzo, ${windowLabel}`, `Sales deposits, ${windowLabel}`),
                  headers: ["Product or outlet", "M-Pesa", "Bank", "Cash", "Total", "Deposits"],
                  rows: byCategory.map((r) => [
                    label(r.category),
                    r.mpesa,
                    r.bank,
                    r.cash,
                    r.total,
                    r.count,
                  ]),
                })}
              />
              {canDeposit && <RecordSalesDepositDialog categories={categories} />}
            </div>
          </div>

          {isPending ? (
            <SectionSkeleton>
              <TableSkeleton rows={8} cols={5} />
            </SectionSkeleton>
          ) : (
            <div className="space-y-4">
              {/* One row per product or outlet: the whole point of the screen. */}
              <SectionCard title={t("Kila bidhaa na jumla yake", "Each product and its total")}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="py-2 px-3">{t("Bidhaa au sehemu", "Product or outlet")}</th>
                        <th className="text-right">M-Pesa</th>
                        <th className="text-right">{t("Benki", "Bank")}</th>
                        <th className="text-right">{t("Taslimu", "Cash")}</th>
                        <th className="text-right px-3">{t("Jumla", "Total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((r) => (
                        <tr
                          key={r.category}
                          className={`border-b border-border last:border-0 ${r.total === 0 ? "opacity-45" : ""}`}
                        >
                          <td className="py-2.5 px-3 font-medium">
                            {label(r.category)}
                            {r.count > 0 && (
                              <span className="ml-2 text-[11px] text-muted-foreground font-num">
                                {r.count}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-num">
                            {r.mpesa > 0 ? tzs(r.mpesa, false) : ""}
                          </td>
                          <td className="py-2.5 text-right font-num">
                            {r.bank > 0 ? tzs(r.bank, false) : ""}
                          </td>
                          <td className="py-2.5 text-right font-num">
                            {r.cash > 0 ? tzs(r.cash, false) : ""}
                          </td>
                          <td className="py-2.5 text-right px-3 font-num font-semibold">
                            {r.total > 0 ? tzs(r.total, false) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                        <td className="py-3 px-3 font-bold">{t("Jumla kuu", "Grand total")}</td>
                        <td className="py-3 text-right font-num font-bold">
                          {tzs(grand.mpesa, false)}
                        </td>
                        <td className="py-3 text-right font-num font-bold">
                          {tzs(grand.bank, false)}
                        </td>
                        <td className="py-3 text-right font-num font-bold">
                          {tzs(grand.cash, false)}
                        </td>
                        <td className="py-3 text-right px-3 font-num font-bold text-base">
                          {tzs(grand.total, false)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* Day by day inside the window, so a month can still answer a
              question about one date without changing view. */}
              {grain !== "day" && byDay.length > 0 && (
                <SectionCard title={t("Kila siku", "Day by day")}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                          {byCategory
                            .filter((c) => c.total > 0)
                            .map((c) => (
                              <th key={c.category} className="text-right">
                                {label(c.category)}
                              </th>
                            ))}
                          <th className="text-right px-3">{t("Jumla", "Total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byDay.map(([date, vals]) => (
                          <tr key={date} className="border-b border-border last:border-0">
                            <td className="py-2 px-3 font-num text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setGrain("day");
                                  setAnchor(date);
                                }}
                                className="hover:underline"
                              >
                                {date}
                              </button>
                            </td>
                            {byCategory
                              .filter((c) => c.total > 0)
                              .map((c) => (
                                <td key={c.category} className="py-2 text-right font-num">
                                  {vals[c.category] ? tzs(vals[c.category], false) : ""}
                                </td>
                              ))}
                            <td className="py-2 text-right px-3 font-num font-semibold">
                              {tzs(vals.__total ?? 0, false)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {t(
                      "Bonyeza tarehe kuona siku hiyo peke yake.",
                      "Click a date to open that day on its own.",
                    )}
                  </div>
                </SectionCard>
              )}

              <SectionCard title={t("Miamala", "The deposits themselves")}>
                {deposits.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title={t("Hakuna amana katika kipindi hiki", "No deposits in this period")}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                          <th>{t("Bidhaa au sehemu", "Product or outlet")}</th>
                          <th>{t("Njia", "Channel")}</th>
                          <th className="text-right">{t("Kiasi", "Amount")}</th>
                          <th className="px-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map((x) => (
                          <tr key={x.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                              {x.date}
                            </td>
                            <td className="py-2.5">
                              <Pill tone="info">{label(x.source)}</Pill>
                            </td>
                            <td className="py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs">
                                {x.method === "mpesa" ? (
                                  <Smartphone className="h-3 w-3" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3" />
                                )}
                                {x.method}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-num font-semibold">
                              {tzs(x.amountTZS)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {x.attachmentUrl && (
                                <a
                                  href={x.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={t("Risiti", "Receipt")}
                                  className="text-[#1E7C3F] hover:opacity-70 mr-2 inline-block align-middle"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {canDeposit && (
                                <EditDepositSheet deposit={x} categories={categories} />
                              )}
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
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// The daily M-Pesa book. Milk goes out over M-Pesa all day in ones and
// twos and nobody rings each one into the counter, so what is written down
// is litres and money, once, for the day. The price per litre is shown
// beside each day on purpose: it is the cheapest check there is, and a
// figure that drifts from the usual one means the litres or the money went
// in wrong.
function MpesaDailyTab({
  from,
  to,
  windowLabel,
}: {
  from: string;
  to: string;
  windowLabel: string;
}) {
  const { t, can } = useApp();
  const canWrite = can("pos:use") || can("finance:write");
  const { data, isPending } = useMpesaDaily(from, to);
  const record = useRecordMpesaDay();
  const remove = useDeleteMpesaDay();

  const [date, setDate] = useState(todayISO());
  const [litres, setLitres] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");

  const days = data?.summary ?? [];
  const entries = data?.entries ?? [];
  const totalL = days.reduce((a, d) => a + d.litres, 0);
  const totalTZS = days.reduce((a, d) => a + d.amountTZS, 0);
  const avg = totalL > 0 ? totalTZS / totalL : 0;
  const ready = litres !== "" && amount !== "" && (litres > 0 || amount > 0);

  const add = () => {
    if (!ready) return;
    record.mutate(
      { date, litres: Number(litres), amountTZS: Number(amount) },
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
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("Tarehe", "Date")}</Label>
              <Input
                type="date"
                value={date}
                max={todayISO()}
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
              <Label className="text-xs">{t("Fedha (TZS)", "Money (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="font-num"
              />
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
          {ready && Number(litres) > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {t("Hii ni", "That works out at")}{" "}
              <span className="font-num font-semibold">{tzs(Number(amount) / Number(litres))}</span>{" "}
              {t("kwa lita", "per litre")}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title={t("Kila siku", "Day by day")}>
        {isPending ? (
          <TableSkeleton rows={5} cols={4} />
        ) : days.length === 0 ? (
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
                  <th className="text-right">{t("Fedha", "Money")}</th>
                  <th className="text-right px-3">{t("Kwa lita", "Per litre")}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs">
                      {d.date}
                      {d.entries > 1 && (
                        <span className="ml-2 text-muted-foreground">
                          {d.entries} {t("mara", "entries")}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-num">{num(d.litres)}</td>
                    <td className="py-2.5 text-right font-num font-semibold">
                      {tzs(d.amountTZS, false)}
                    </td>
                    <td className="py-2.5 text-right px-3 font-num text-muted-foreground">
                      {tzs(d.perLitre, false)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                  <td className="py-3 px-3 font-bold">{t("Jumla", "Total")}</td>
                  <td className="py-3 text-right font-num font-bold">{num(totalL)}</td>
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
                <span className="flex-1 font-num">
                  {num(e.litres)} L · {tzs(e.amountTZS)}
                  {e.note && <span className="ml-2 text-xs text-muted-foreground">{e.note}</span>}
                </span>
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
  );
}

// Correcting a deposit already recorded. A wrong figure, the wrong
// product, or one entered twice: all of it happens, and until now none of
// it could be put right. Deleting restores whatever balance the deposit
// moved and reverses its ledger entry, so a correction never leaves the
// books disagreeing with the record.
function EditDepositSheet({
  deposit,
  categories,
}: {
  deposit: DepositRecord;
  categories: string[];
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(deposit.source);
  const [date, setDate] = useState(deposit.date);
  const [amount, setAmount] = useState<number>(deposit.amountTZS);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">(deposit.method);
  const update = useUpdateDeposit();
  const remove = useDeleteDeposit();

  const changed =
    category !== deposit.source ||
    date !== deposit.date ||
    amount !== deposit.amountTZS ||
    method !== deposit.method;

  const save = () => {
    if (amount <= 0) return;
    update.mutate(
      {
        id: deposit.id,
        date,
        amountTZS: amount,
        method,
        source: category,
        customerId: deposit.customerId,
      },
      {
        onSuccess: () => {
          toast.success(t("Imerekebishwa", "Corrected"));
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kurekebisha", "Could not correct the deposit")),
      },
    );
  };

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
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground font-num">
            {deposit.ref ?? deposit.id} · {t("iliwekwa", "recorded")} {deposit.date}
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Bidhaa au sehemu", "Product or outlet")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(SOURCE_LABEL[c]?.sw ?? c, SOURCE_LABEL[c]?.en ?? c)}
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
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">{t("Benki", "Bank")}</SelectItem>
                <SelectItem value="cash">{t("Taslimu", "Cash")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <ConfirmDialog
            destructive
            title={t("Futa amana hii?", "Remove this deposit?")}
            description={t(
              "Itaondolewa kabisa, na vitabu vitarekebishwa. Tumia hii kwa amana iliyorekodiwa mara mbili.",
              "It is removed entirely and the books are corrected to match. Use this for one that was recorded twice.",
            )}
            confirmLabel={t("Futa", "Remove")}
            onConfirm={() =>
              remove.mutate(
                { id: deposit.id, reason: "Removed from sales deposits" },
                {
                  onSuccess: () => {
                    toast.success(t("Imefutwa", "Removed"));
                    setOpen(false);
                  },
                  onError: () => toast.error(t("Imeshindikana kufuta", "Could not remove it")),
                },
              )
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
            <Button onClick={save} disabled={!changed || amount <= 0 || update.isPending}>
              {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const NEW_SALES_CATEGORY = "__new__";

function RecordSalesDepositDialog({ categories }: { categories: string[] }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const record = useRecordDeposit();
  const createCategory = useCreateSalesDepositCategory();

  const draft = useFormDraft({
    key: "sales-deposit",
    enabled: open,
    value: { category, newCategory, date, amount, method },
    onRestore: (v) => {
      setCategory(v.category);
      setNewCategory(v.newCategory);
      setDate(v.date);
      setAmount(v.amount);
      setMethod(v.method);
    },
  });

  const isNewCategory = category === NEW_SALES_CATEGORY;
  const finalCategory = isNewCategory ? newCategory.trim().toLowerCase() : category;

  const save = async () => {
    if (!finalCategory || amount <= 0) return;
    setSaving(true);
    try {
      const attachmentUrl = file ? await uploadHardCopy(file, "deposit") : undefined;
      if (isNewCategory) await createCategory.mutateAsync(finalCategory);
      record.mutate(
        { source: finalCategory, method, amountTZS: amount, date, attachmentUrl },
        {
          onSuccess: () => {
            toast.success(t("Amana imerekodiwa", "Deposit recorded"));
            draft.clear();
            setOpen(false);
            setAmount(0);
            setFile(null);
            setNewCategory("");
          },
          onError: () => toast.error(t("Imeshindikana kurekodi", "Could not record the deposit")),
          onSettled: () => setSaving(false),
        },
      );
    } catch {
      toast.error(t("Imeshindikana kupakia risiti", "Could not upload the receipt"));
      setSaving(false);
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
          {t("Amana mpya", "New deposit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekodi amana ya mauzo", "Record a sales deposit")}</SheetTitle>
        </SheetHeader>
        <DraftNotice
          show={draft.restored}
          onDiscard={() => {
            draft.clear();
            setAmount(0);
            setNewCategory("");
          }}
        />
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Aina/Sehemu", "Category/outlet")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(SOURCE_LABEL[c]?.sw ?? c, SOURCE_LABEL[c]?.en ?? c)}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SALES_CATEGORY}>{t("Ongeza mpya…", "Add new…")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isNewCategory && (
            <div className="grid gap-1.5">
              <Label>{t("Jina la aina mpya", "New category name")}</Label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t("mfano: Njiro", "e.g. Njiro")}
              />
            </div>
          )}
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
              <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Njia", "Channel")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Risiti (hiari, picha au PDF)", "Receipt (optional, photo or PDF)")}</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {file && <div className="text-[11px] text-muted-foreground">{file.name}</div>}
            <div className="text-[11px] text-muted-foreground">
              {t(
                "Rejea hutengenezwa na mfumo. Unaweza kuhifadhi sasa na kupakia risiti baadaye.",
                "The reference is generated by the system. You can save now and attach the receipt later.",
              )}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={saving || record.isPending || amount <= 0}>
            {saving || record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
