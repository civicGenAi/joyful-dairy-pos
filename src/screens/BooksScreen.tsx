import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: every figure on this screen is read from the general ledger
// (src/lib/data/ledger). Nothing here computes accounting itself, so the
// statements can never disagree with the books behind them.
import {
  useTrialBalance,
  useProfitLoss,
  useBalanceSheet,
  useVatReturn,
  usePostLedger,
  useOpeningBalances,
  useSuggestedOpening,
  useSetOpeningBalances,
  useCashFlow,
  usePostingStatus,
  useLockedPeriods,
  useLockPeriod,
  useUnlockPeriod,
  useBankRecLines,
  useManualEntry,
  useSetCleared,
  useCloseBankRec,
  useAddBankItem,
} from "@/lib/data/hooks/ledger";
import type { LedgerAccount } from "@/lib/data/ledger";
import { useAssetSchedule, useCreateAsset, usePostDepreciation } from "@/lib/data/hooks/assets";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCustomers } from "@/lib/data/hooks/customers";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { tzs, num } from "@/lib/format";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RefreshCw,
  Scale,
  Wand2,
  Plus,
  Truck,
  Lock,
  LockOpen,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function BooksScreen() {
  const { t, lang, can } = useApp();
  const canPost = can("finance:write");
  const currentMonth = todayISO().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, viewMon] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(viewYear, viewMon, 0).getDate();
  const from = `${viewMonth}-01`;
  const to = `${viewMonth}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: pl = [], isPending } = useProfitLoss(from, to);
  const { data: bs = [] } = useBalanceSheet(to);
  const { data: tb = [] } = useTrialBalance(from, to);
  const { data: vat } = useVatReturn(from, to);
  const post = usePostLedger();
  const { data: status } = usePostingStatus();
  const { data: locks = [] } = useLockedPeriods();
  const lockPeriod = useLockPeriod();
  const unlockPeriod = useUnlockPeriod();
  const isLocked = locks.some((l) => l.period === viewMonth);

  const monthLabel = new Date(`${from}T00:00:00`).toLocaleDateString(
    lang === "sw" ? "sw-TZ" : "en-GB",
    { month: "long", year: "numeric" },
  );
  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMon - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nameOf = (a: LedgerAccount) => (lang === "sw" ? a.swName : a.name);

  // Profit and loss, in the order a reader expects: what came in, what the
  // milk cost, what running the place cost, and what is left.
  const revenue = pl.filter((a) => a.type === "revenue");
  const cogs = pl.filter((a) => a.subtype === "cogs");
  const opex = pl.filter((a) => a.type === "expense" && a.subtype !== "cogs");
  const totalRevenue = revenue.reduce((s, a) => s + a.amount, 0);
  const totalCogs = cogs.reduce((s, a) => s + a.amount, 0);
  const totalOpex = opex.reduce((s, a) => s + a.amount, 0);
  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - totalOpex;

  const assets = bs.filter((a) => a.type === "asset");
  const liabilities = bs.filter((a) => a.type === "liability");
  const equity = bs.filter((a) => a.type === "equity");
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
  const totalEquity = equity.reduce((s, a) => s + a.amount, 0);
  // The books are only trustworthy if this holds. Shown, not hidden, so a
  // problem surfaces here rather than in front of an accountant.
  const balances = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const runPosting = () =>
    post.mutate(
      { from, to },
      {
        onSuccess: (r) =>
          toast.success(
            r.posted > 0
              ? t(`Miamala ${r.posted} imewekwa vitabuni`, `Posted ${r.posted} transactions`)
              : t("Kila kitu kilikuwa tayari kimewekwa", "Everything was already posted"),
          ),
        onError: () =>
          toast.error(t("Imeshindikana kuweka vitabuni", "Could not post to the ledger")),
      },
    );

  return (
    <AppShell title={t("Vitabu vya hesabu", "Books")}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold w-40 text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={viewMonth >= currentMonth}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <Pill tone="info">
              <Lock className="h-3 w-3" />
              {t("Kipindi kimefungwa", "Period locked")}
            </Pill>
          )}
          {canPost && !isLocked && (
            <ConfirmDialog
              title={t("Funga kipindi hiki?", "Lock this period?")}
              description={t(
                "Baada ya kufunga, hakuna muamala mpya utakaoingia kwenye mwezi huu. Marekebisho yatakwenda kwenye mwezi unaofuata ulio wazi. Fanya hivi baada ya kuwasilisha VAT.",
                "Once locked, no new entry can land in this month. Corrections go to the next open month instead. Do this after you have filed the VAT return.",
              )}
              confirmLabel={t("Funga", "Lock")}
              onConfirm={() =>
                lockPeriod.mutate(
                  { period: viewMonth },
                  {
                    onSuccess: () => toast.success(t("Kipindi kimefungwa", "Period locked")),
                    onError: (e) =>
                      toast.error(
                        e.message.includes("unposted-transactions")
                          ? t(
                              "Weka miamala yote vitabuni kwanza",
                              "Post everything in this month to the ledger first",
                            )
                          : t("Imeshindikana kufunga", "Could not lock the period"),
                      ),
                  },
                )
              }
              trigger={
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  {t("Funga kipindi", "Lock period")}
                </Button>
              }
            />
          )}
          {canPost && isLocked && (
            <ConfirmDialog
              destructive
              title={t("Fungua kipindi kilichofungwa?", "Reopen a locked period?")}
              description={t(
                "Hii inaruhusu takwimu za mwezi uliokwisha wasilishwa kubadilika. Itaandikwa kwenye kumbukumbu.",
                "This allows a month you have already reported on to change. It is recorded in the audit log.",
              )}
              confirmLabel={t("Fungua", "Reopen")}
              onConfirm={() =>
                unlockPeriod.mutate(
                  { period: viewMonth, reason: "Reopened from Books" },
                  {
                    onSuccess: () => toast.success(t("Kimefunguliwa", "Period reopened")),
                    onError: () => toast.error(t("Imeshindikana", "Could not reopen the period")),
                  },
                )
              }
              trigger={
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <LockOpen className="h-3.5 w-3.5 mr-1.5" />
                  {t("Fungua", "Reopen")}
                </Button>
              }
            />
          )}
          {canPost && (
            <Button
              size="sm"
              onClick={runPosting}
              disabled={post.isPending}
              className="h-8 text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${post.isPending ? "animate-spin" : ""}`} />
              {post.isPending
                ? t("Inaweka vitabuni…", "Posting…")
                : t("Weka vitabuni", "Post to ledger")}
            </Button>
          )}
        </div>
      </div>

      {/* How current the books are. An unposted month otherwise looks
          exactly like a quiet one, which is the more dangerous of the two. */}
      {status && status.unpostedCount > 0 && (
        <div className="mb-4 rounded-xl border border-[#E5A100]/40 bg-[#E5A100]/10 px-3.5 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-[#8a5a00] shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-[#8a5a00]">
            {t(
              `Miamala ${status.unpostedCount} bado haijawekwa vitabuni, ya zamani zaidi ni ya ${status.oldestUnposted}. Takwimu hapa chini hazijakamilika mpaka iwekwe.`,
              `${status.unpostedCount} transactions are not in the ledger yet, the oldest from ${status.oldestUnposted}. The figures below are incomplete until they are posted.`,
            )}
          </div>
        </div>
      )}
      {status && status.unpostedCount === 0 && status.lastPostedDate && (
        <div className="mb-4 text-[11px] text-muted-foreground">
          {t(
            `Vitabu vimewekwa hadi ${status.lastPostedDate}. Vinawekwa vyenyewe kila usiku.`,
            `Books posted up to ${status.lastPostedDate}. Posting runs automatically each night.`,
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Mapato", "Revenue")} value={tzs(totalRevenue)} accent="green" />
        <StatCard
          label={t("Faida ghafi", "Gross profit")}
          value={tzs(grossProfit)}
          sub={t("Baada ya gharama ya maziwa", "After the cost of milk")}
          accent="info"
        />
        <StatCard
          label={t("Faida halisi", "Net profit")}
          value={tzs(netProfit)}
          accent={netProfit >= 0 ? "green" : "red"}
        />
        <StatCard
          label={t("VAT ya kulipa TRA", "VAT payable to TRA")}
          value={tzs(vat?.netPayable ?? 0)}
          accent="amber"
        />
      </div>

      {isPending ? (
        <SectionSkeleton>
          <TableSkeleton rows={8} cols={2} />
        </SectionSkeleton>
      ) : (
        <Tabs defaultValue="pl">
          <TabsList>
            <TabsTrigger value="pl">{t("Faida na hasara", "Profit & loss")}</TabsTrigger>
            <TabsTrigger value="bs">{t("Mizania", "Balance sheet")}</TabsTrigger>
            <TabsTrigger value="tb">{t("Salio la majaribio", "Trial balance")}</TabsTrigger>
            <TabsTrigger value="cash">{t("Mtiririko wa fedha", "Cash flow")}</TabsTrigger>
            <TabsTrigger value="bank">{t("Kulinganisha benki", "Bank rec")}</TabsTrigger>
            <TabsTrigger value="vat">{t("VAT", "VAT return")}</TabsTrigger>
            <TabsTrigger value="assets">{t("Mali za kudumu", "Fixed assets")}</TabsTrigger>
            <TabsTrigger value="opening">{t("Salio la kuanzia", "Opening balances")}</TabsTrigger>
          </TabsList>

          {/* ---- Profit & loss ---- */}
          <TabsContent value="pl" className="mt-4">
            <SectionCard
              title={t(`Faida na hasara, ${monthLabel}`, `Profit & loss, ${monthLabel}`)}
              action={
                <ExportMenu
                  formats={["csv", "excel", "pdf"]}
                  filename={`profit-loss-${viewMonth}`}
                  data={() => ({
                    title: t(`Faida na hasara, ${monthLabel}`, `Profit & loss, ${monthLabel}`),
                    headers: ["Code", "Account", "Amount TZS"],
                    rows: pl.map((a) => [a.code, nameOf(a), a.amount]),
                  })}
                />
              }
            >
              {pl.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={t("Hakuna kilichowekwa vitabuni", "Nothing posted for this month")}
                  description={t(
                    "Bonyeza Weka vitabuni kuandika miamala ya mwezi huu.",
                    "Use Post to ledger to write this month's transactions into the books.",
                  )}
                />
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    <Group label={t("Mapato", "Revenue")} rows={revenue} nameOf={nameOf} />
                    <Total label={t("Jumla ya mapato", "Total revenue")} value={totalRevenue} />
                    <Group
                      label={t("Gharama ya mauzo", "Cost of sales")}
                      rows={cogs}
                      nameOf={nameOf}
                    />
                    <Total label={t("Faida ghafi", "Gross profit")} value={grossProfit} />
                    <Group
                      label={t("Matumizi ya uendeshaji", "Operating expenses")}
                      rows={opex}
                      nameOf={nameOf}
                    />
                    <Total label={t("Faida halisi", "Net profit")} value={netProfit} strong />
                  </tbody>
                </table>
              )}
              <div className="mt-3 text-[11px] text-muted-foreground">
                {t(
                  "Matumizi ya mmiliki (Madam) hayapo hapa. Ni kuchukua kwa mmiliki, siyo gharama ya biashara, hivyo yanapunguza mtaji kwenye mizania.",
                  "Owner spending (Madam) is not here. It is drawings, not a business cost, so it reduces equity on the balance sheet instead.",
                )}
              </div>
            </SectionCard>
          </TabsContent>

          {/* ---- Balance sheet ---- */}
          <TabsContent value="bs" className="mt-4">
            <SectionCard
              title={t(`Mizania, ${to}`, `Balance sheet as at ${to}`)}
              action={
                <div className="flex items-center gap-2">
                  <Pill tone={balances ? "success" : "danger"}>
                    <Scale className="h-3 w-3" />
                    {balances ? t("Inalingana", "Balances") : t("Hailingani", "Does not balance")}
                  </Pill>
                  <ExportMenu
                    formats={["csv", "excel", "pdf"]}
                    filename={`balance-sheet-${viewMonth}`}
                    data={() => ({
                      title: t(`Mizania, ${to}`, `Balance sheet as at ${to}`),
                      headers: ["Code", "Account", "Amount TZS"],
                      rows: bs.map((a) => [a.code, nameOf(a), a.amount]),
                    })}
                  />
                </div>
              }
            >
              {bs.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={t("Hakuna kilichowekwa vitabuni", "Nothing posted yet")}
                />
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    <Group label={t("Mali", "Assets")} rows={assets} nameOf={nameOf} />
                    <Total label={t("Jumla ya mali", "Total assets")} value={totalAssets} />
                    <Group label={t("Madeni", "Liabilities")} rows={liabilities} nameOf={nameOf} />
                    <Total
                      label={t("Jumla ya madeni", "Total liabilities")}
                      value={totalLiabilities}
                    />
                    <Group label={t("Mtaji", "Equity")} rows={equity} nameOf={nameOf} />
                    <Total label={t("Jumla ya mtaji", "Total equity")} value={totalEquity} />
                    <Total
                      label={t("Madeni na mtaji", "Liabilities + equity")}
                      value={totalLiabilities + totalEquity}
                      strong
                    />
                  </tbody>
                </table>
              )}
            </SectionCard>
          </TabsContent>

          {/* ---- Trial balance ---- */}
          <TabsContent value="tb" className="mt-4">
            <SectionCard
              title={t(`Salio la majaribio, ${monthLabel}`, `Trial balance, ${monthLabel}`)}
              action={
                <div className="flex items-center gap-2">
                  {canPost && <ManualEntrySheet accounts={tb} />}
                  <ExportMenu
                    formats={["csv", "excel", "pdf"]}
                    filename={`trial-balance-${viewMonth}`}
                    data={() => ({
                      title: t(`Salio la majaribio, ${monthLabel}`, `Trial balance, ${monthLabel}`),
                      headers: ["Code", "Account", "Debit", "Credit"],
                      rows: tb.map((a) => [a.code, nameOf(a), a.debit ?? 0, a.credit ?? 0]),
                    })}
                  />
                </div>
              }
            >
              {tb.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={t("Hakuna kilichowekwa vitabuni", "Nothing posted yet")}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Namba", "Code")}</th>
                      <th>{t("Akaunti", "Account")}</th>
                      <th className="text-right">{t("Deni", "Debit")}</th>
                      <th className="text-right px-3">{t("Mkopo", "Credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tb.map((a) => (
                      <tr key={a.code} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 font-num text-xs text-muted-foreground">
                          {a.code}
                        </td>
                        <td className="py-2">{nameOf(a)}</td>
                        <td className="py-2 text-right font-num">
                          {a.debit ? tzs(a.debit, false) : ""}
                        </td>
                        <td className="py-2 text-right px-3 font-num">
                          {a.credit ? tzs(a.credit, false) : ""}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                      <td />
                      <td className="py-2.5 font-bold">{t("Jumla", "Total")}</td>
                      <td className="py-2.5 text-right font-num font-bold">
                        {tzs(
                          tb.reduce((s, a) => s + (a.debit ?? 0), 0),
                          false,
                        )}
                      </td>
                      <td className="py-2.5 text-right px-3 font-num font-bold">
                        {tzs(
                          tb.reduce((s, a) => s + (a.credit ?? 0), 0),
                          false,
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </SectionCard>
          </TabsContent>

          {/* ---- VAT ---- */}
          <TabsContent value="vat" className="mt-4">
            <SectionCard title={t(`VAT, ${monthLabel}`, `VAT return, ${monthLabel}`)}>
              <ul className="text-sm divide-y divide-border">
                <VatRow
                  label={t("Mauzo bila VAT", "Sales excluding VAT")}
                  value={vat?.salesExVat ?? 0}
                />
                <VatRow
                  label={t("Mauzo yasiyo na VAT", "Exempt or zero-rated sales")}
                  value={vat?.exemptSales ?? 0}
                />
                <VatRow
                  label={t("VAT ya mauzo (output)", "Output VAT charged")}
                  value={vat?.outputVat ?? 0}
                />
                <VatRow
                  label={t("VAT ya manunuzi (input)", "Input VAT reclaimable")}
                  value={vat?.inputVat ?? 0}
                />
              </ul>
              <div
                className="mt-3 rounded-xl border-2 p-3.5 flex items-center justify-between bg-[#F4F6F2]"
                style={{ borderColor: "#1E6B3A" }}
              >
                <span className="text-sm font-semibold">
                  {(vat?.netPayable ?? 0) >= 0
                    ? t("Kulipa TRA", "Payable to TRA")
                    : t("Kurudishiwa na TRA", "Refundable from TRA")}
                </span>
                <span className="font-num font-bold text-lg">
                  {tzs(Math.abs(vat?.netPayable ?? 0))}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                {t(
                  "VAT inatolewa kwenye bei iliyojumuisha VAT, kwa kiwango cha kila bidhaa. Bidhaa zisizo na VAT ziwekwe 0% kwenye Bidhaa. VAT ya manunuzi inahesabiwa pale tu matumizi yana namba ya ankara.",
                  "VAT is extracted from the VAT-inclusive price at each product's own rate. Set exempt products to 0% under Products. Input VAT is only counted where an expense carries an invoice reference.",
                )}
              </div>
            </SectionCard>
          </TabsContent>
          {/* ---- Cash flow ---- */}
          <TabsContent value="cash" className="mt-4">
            <CashFlowTab from={from} to={to} monthLabel={monthLabel} />
          </TabsContent>

          {/* ---- Bank reconciliation ---- */}
          <TabsContent value="bank" className="mt-4">
            <BankRecTab to={to} />
          </TabsContent>

          {/* ---- Fixed assets ---- */}
          <TabsContent value="assets" className="mt-4">
            <FixedAssetsTab month={from} monthLabel={monthLabel} />
          </TabsContent>

          {/* ---- Opening balances ---- */}
          <TabsContent value="opening" className="mt-4">
            <OpeningBalancesTab />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
// A manual journal: the accrual, prepayment or correction that no posting
// engine can produce. Deliberately plain, two lines minimum, and it will
// not save until the two sides agree, which is the same rule the database
// enforces underneath.
function ManualEntrySheet({ accounts }: { accounts: LedgerAccount[] }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState([
    { account: "", debit: 0, credit: 0 },
    { account: "", debit: 0, credit: 0 },
  ]);
  const post = useManualEntry();
  // Every account, not just the ones with a balance this month, otherwise
  // you could never post to an account that has not been used yet.
  const { data: all = [] } = useTrialBalance("1900-01-01", todayISO());
  const options = all.length > 0 ? all : accounts;

  const totalDebit = rows.reduce((a, r) => a + (r.debit || 0), 0);
  const totalCredit = rows.reduce((a, r) => a + (r.credit || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;
  const usable = rows.filter((r) => r.account && (r.debit > 0 || r.credit > 0));

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r, ix) => (ix === i ? { ...r, ...patch } : r)));

  const save = () => {
    if (!balanced || usable.length < 2 || !memo.trim()) return;
    post.mutate(
      { date, memo, lines: usable },
      {
        onSuccess: () => {
          toast.success(t("Kidokezo kimewekwa", "Journal posted"));
          setOpen(false);
          setMemo("");
          setRows([
            { account: "", debit: 0, credit: 0 },
            { account: "", debit: 0, credit: 0 },
          ]);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("period-locked")
              ? t("Kipindi hiki kimefungwa", "That period is locked")
              : t("Imeshindikana kuweka", "Could not post the journal"),
          ),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("Kidokezo cha mkono", "Manual journal")}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-4"
      >
        <SheetHeader>
          <SheetTitle>{t("Kidokezo cha mkono", "Manual journal entry")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Kwa mambo ambayo mfumo hauwezi kujua: gharama iliyotumika bila ankara, marekebisho, au kufunga mwaka.",
              "For what the system cannot know on its own: an accrual, a prepayment, a correction, or a year-end adjustment.",
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Maelezo", "Description")}</Label>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={t("mf. Umeme wa Septemba", "e.g. September electricity")}
              />
            </div>
          </div>

          <div className="grid gap-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_110px] gap-2">
                <Select value={r.account} onValueChange={(v) => setRow(i, { account: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Chagua akaunti", "Pick an account")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((a) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} · {lang === "sw" ? a.swName : a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  placeholder={t("Deni", "Debit")}
                  value={r.debit || ""}
                  onChange={(e) => setRow(i, { debit: Number(e.target.value) || 0, credit: 0 })}
                  className="font-num"
                />
                <Input
                  type="number"
                  step="any"
                  placeholder={t("Mkopo", "Credit")}
                  value={r.credit || ""}
                  onChange={(e) => setRow(i, { credit: Number(e.target.value) || 0, debit: 0 })}
                  className="font-num"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, { account: "", debit: 0, credit: 0 }])}
              className="text-[11px] font-semibold text-[#1E7C3F] hover:underline w-fit"
            >
              {t("Ongeza mstari", "Add a line")}
            </button>
          </div>

          <div
            className="rounded-xl border-2 p-3 flex items-center justify-between"
            style={{
              borderColor: balanced ? "#1E6B3A" : "#E11B22",
              background: balanced ? "#F4F6F2" : "transparent",
            }}
          >
            <span className="text-sm font-semibold">
              {balanced
                ? t("Pande zote mbili zinalingana", "Both sides agree")
                : t("Bado hazilingani", "The two sides do not agree yet")}
            </span>
            <span className="font-num text-sm">
              {tzs(totalDebit, false)} / {tzs(totalCredit, false)}
            </span>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={!balanced || usable.length < 2 || !memo.trim() || post.isPending}
          >
            {post.isPending ? t("Inaweka…", "Posting…") : t("Weka vitabuni", "Post")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// The other half of a reconciliation: something the statement shows that
// the books never saw. Money is banked late and receipts arrive later, so
// a statement here routinely carries charges, interest and customers who
// paid straight in. Without this the difference could be seen but not
// resolved, and people go back to reconciling in a notebook.
const BANK_ITEM_PRESETS: {
  id: string;
  sw: string;
  en: string;
  direction: "in" | "out";
  account: string;
  needsCustomer?: boolean;
}[] = [
  { id: "charge", sw: "Gharama za benki", en: "Bank charge", direction: "out", account: "6080" },
  { id: "interest", sw: "Riba", en: "Interest received", direction: "in", account: "4920" },
  {
    id: "customer",
    sw: "Mteja amelipa moja kwa moja",
    en: "Customer paid straight in",
    direction: "in",
    account: "1100",
    needsCustomer: true,
  },
  {
    id: "other-in",
    sw: "Kingine kimeingia",
    en: "Other money in",
    direction: "in",
    account: "4900",
  },
  {
    id: "other-out",
    sw: "Kingine kimetoka",
    en: "Other money out",
    direction: "out",
    account: "6900",
  },
];

function AddBankItemSheet({ account, asAt }: { account: string; asAt: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("charge");
  const [date, setDate] = useState(asAt);
  const [amount, setAmount] = useState<number | "">("");
  const [memo, setMemo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const { data: customers = [] } = useCustomers();
  const add = useAddBankItem();

  const chosen = BANK_ITEM_PRESETS.find((p) => p.id === preset) ?? BANK_ITEM_PRESETS[0];
  const needsCustomer = chosen.needsCustomer === true;
  const ready = amount !== "" && amount > 0 && memo.trim() !== "" && (!needsCustomer || customerId);

  const save = () => {
    if (!ready) return;
    add.mutate(
      {
        account,
        date,
        amount: Number(amount),
        direction: chosen.direction,
        contraAccount: chosen.account,
        memo,
        customerId: needsCustomer ? customerId : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("Kimeongezwa na kimehakikiwa", "Added and ticked off"));
          setOpen(false);
          setAmount("");
          setMemo("");
          setCustomerId("");
        },
        onError: (e: Error) =>
          toast.error(
            e.message.includes("period-locked")
              ? t("Kipindi hiki kimefungwa", "That period is locked")
              : t("Imeshindikana kuongeza", "Could not add the item"),
          ),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("Ongeza kutoka taarifa", "Add from statement")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>
            {t("Kipengele cha taarifa ya benki", "Item from the bank statement")}
          </SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Kwa kitu kilichopo kwenye taarifa ya benki lakini hakikuingizwa hapa. Kitawekwa vitabuni na kuhakikiwa mara moja, kwa sababu benki tayari imekiona.",
              "For something on the bank statement that was never entered here. It is posted and ticked off at once, because the bank has already seen it.",
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Ni kitu gani", "What is it")}</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANK_ITEM_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {t(p.sw, p.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsCustomer && (
            <div className="grid gap-1.5">
              <Label>{t("Mteja", "Customer")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Chagua mteja", "Pick the customer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers
                    .filter((c) => c.outstandingTZS > 0)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {tzs(c.outstandingTZS)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Deni lake litapungua pia, siyo vitabu peke yake.",
                  "Their balance comes down too, not just the ledger.",
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Tarehe", "Date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>
                {chosen.direction === "in"
                  ? t("Kiasi kilichoingia", "Amount in")
                  : t("Kiasi kilichotoka", "Amount out")}
              </Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="font-num"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Maelezo", "Description")}</Label>
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("Kama ilivyo kwenye taarifa", "As it reads on the statement")}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={!ready || add.isPending}>
            {add.isPending ? t("Inaongeza…", "Adding…") : t("Ongeza", "Add")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Bank reconciliation: tick off what the statement shows, then say what the
// statement said. The difference is the whole point of the exercise, so it
// is shown plainly and stored even when it is not zero.
function BankRecTab({ to }: { to: string }) {
  const { t, can } = useApp();
  const canWrite = can("finance:write");
  const [account, setAccount] = useState("1010");
  const { data, isPending } = useBankRecLines(account, to);
  const setCleared = useSetCleared();
  const close = useCloseBankRec();
  const [statement, setStatement] = useState<number | "">("");
  const [note, setNote] = useState("");

  const lines = data?.lines ?? [];
  const summary = data?.summary;
  const difference =
    statement === "" || !summary
      ? null
      : Math.round((statement - summary.clearedBalance) * 100) / 100;

  const toggle = (lineId: string, cleared: boolean) =>
    setCleared.mutate(
      { lineIds: [lineId], cleared },
      { onError: () => toast.error(t("Imeshindikana", "Could not update the line")) },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1010">{t("Benki", "Bank")}</SelectItem>
            <SelectItem value="1020">M-Pesa</SelectItem>
            <SelectItem value="1000">{t("Fedha mkononi", "Cash on hand")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">{t(`Hadi ${to}`, `Up to ${to}`)}</span>
        {canWrite && <AddBankItemSheet account={account} asAt={to} />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t("Vitabu vinasema", "Ledger says")}
          value={tzs(summary?.ledgerBalance ?? 0)}
          accent="info"
        />
        <StatCard
          label={t("Imethibitishwa benki", "Confirmed by bank")}
          value={tzs(summary?.clearedBalance ?? 0)}
          accent="green"
        />
        <StatCard
          label={t("Benki bado haijaona", "Bank has not seen yet")}
          value={tzs(summary?.unclearedTotal ?? 0)}
          sub={`${num(summary?.unclearedCount ?? 0)} ${t("vipengele", "items")}`}
          accent="amber"
        />
        <StatCard
          label={t("Tofauti", "Difference")}
          value={difference === null ? "-" : tzs(difference)}
          sub={
            difference === null
              ? t("Weka salio la benki", "Enter the bank balance")
              : difference === 0
                ? t("Inalingana", "Reconciles")
                : t("Chunguza", "Investigate this")
          }
          accent={difference === null ? "info" : difference === 0 ? "green" : "red"}
        />
      </div>

      {canWrite && (
        <SectionCard title={t("Maliza kulinganisha", "Close the reconciliation")}>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">
                {t("Salio kwenye taarifa ya benki", "Balance on the bank statement")}
              </Label>
              <Input
                type="number"
                step="any"
                value={statement}
                onChange={(e) => setStatement(e.target.value === "" ? "" : Number(e.target.value))}
                className="font-num"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("Maelezo (hiari)", "Note (optional)")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button
              disabled={statement === "" || close.isPending}
              onClick={() =>
                close.mutate(
                  { account, statementDate: to, statementBalance: Number(statement), note },
                  {
                    onSuccess: (r) =>
                      toast.success(
                        r.difference === 0
                          ? t("Inalingana kabisa", "Reconciles exactly")
                          : t(
                              `Imehifadhiwa, tofauti ${tzs(r.difference)}`,
                              `Saved with a difference of ${tzs(r.difference)}`,
                            ),
                      ),
                    onError: () => toast.error(t("Imeshindikana", "Could not save")),
                  },
                )
              }
              className="text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              {t("Hifadhi", "Save reconciliation")}
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {t(
              "Tofauti inahifadhiwa hata kama si sifuri. Kuipata ndio lengo la zoezi hili.",
              "A difference is saved even when it is not zero. Finding one is the point of the exercise.",
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t("Vipengele", "Items")}>
        {isPending ? (
          <TableSkeleton rows={6} cols={4} />
        ) : lines.length === 0 ? (
          <EmptyState icon={Scale} title={t("Hakuna vipengele", "Nothing on this account yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 w-10">{t("Imeonekana", "Seen")}</th>
                  <th>{t("Tarehe", "Date")}</th>
                  <th>{t("Maelezo", "Description")}</th>
                  <th className="text-right">{t("Imeingia", "In")}</th>
                  <th className="text-right px-3">{t("Imetoka", "Out")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.lineId}
                    className={`border-b border-border last:border-0 ${l.cleared ? "" : "bg-[#E5A100]/5"}`}
                  >
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={l.cleared}
                        disabled={!canWrite || setCleared.isPending}
                        onChange={(e) => toggle(l.lineId, e.target.checked)}
                        className="h-4 w-4 accent-[#1E7C3F]"
                      />
                    </td>
                    <td className="py-2 font-num text-xs text-muted-foreground">{l.entryDate}</td>
                    <td className="py-2">{l.memo}</td>
                    <td className="py-2 text-right font-num">
                      {l.debit > 0 ? tzs(l.debit, false) : ""}
                    </td>
                    <td className="py-2 text-right px-3 font-num">
                      {l.credit > 0 ? tzs(l.credit, false) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// Profit and cash are not the same thing, and the gap between them is what
// catches people out: a good month whose profit is sitting in unpaid
// invoices, or went out as a chiller, or was drawn by the owner. This walks
// from one to the other and then checks itself against what the bank
// actually did, reporting any gap rather than quietly absorbing it.
function CashFlowTab({ from, to, monthLabel }: { from: string; to: string; monthLabel: string }) {
  const { t } = useApp();
  const { data: cf, isPending } = useCashFlow(from, to);

  if (isPending || !cf) return <TableSkeleton rows={8} cols={2} />;

  const line = (label: string, value: number, muted?: boolean) => (
    <tr className="border-b border-border last:border-0">
      <td className={`py-2 pl-3 ${muted ? "text-muted-foreground" : ""}`}>{label}</td>
      <td className="py-2 text-right pr-3 font-num">{tzs(value, false)}</td>
    </tr>
  );

  return (
    <SectionCard
      title={t(`Mtiririko wa fedha, ${monthLabel}`, `Cash flow, ${monthLabel}`)}
      action={
        <ExportMenu
          formats={["csv", "excel", "pdf"]}
          filename={`cash-flow-${from.slice(0, 7)}`}
          data={() => ({
            title: t(`Mtiririko wa fedha, ${monthLabel}`, `Cash flow, ${monthLabel}`),
            headers: ["Item", "Amount TZS"],
            rows: [
              ["Profit for the period", cf.profit],
              ["Depreciation added back", cf.depreciation],
              ["Change in receivables", cf.receivablesChange],
              ["Change in payables", cf.payablesChange],
              ["Change in tax and VAT owed", cf.taxPayablesChange],
              ["Cash from operations", cf.operating],
              ["Equipment purchased", cf.assetsPurchased],
              ["Owner drawings", cf.ownerDrawings],
              ["Capital introduced", cf.capitalIntroduced],
              ["Net change in cash", cf.netChange],
              ["Opening cash", cf.openingCash],
              ["Closing cash", cf.closingCash],
            ],
          })}
        />
      }
    >
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td
              colSpan={2}
              className="pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("Kutoka kwenye biashara", "From operations")}
            </td>
          </tr>
          {line(t("Faida ya kipindi", "Profit for the period"), cf.profit)}
          {line(
            t("Jumlisha uchakavu (hakuna fedha iliyotoka)", "Add back depreciation, no cash moved"),
            cf.depreciation,
            true,
          )}
          {line(
            t("Mabadiliko ya madeni ya wateja", "Change in what customers owe"),
            cf.receivablesChange,
            true,
          )}
          {line(
            t("Mabadiliko ya tunayodaiwa", "Change in what we owe suppliers and farmers"),
            cf.payablesChange,
            true,
          )}
          {line(
            t("Kodi na VAT tunazoshikilia", "Tax and VAT collected, not yet remitted"),
            cf.taxPayablesChange,
            true,
          )}
          <Total label={t("Fedha kutoka biashara", "Cash from operations")} value={cf.operating} />

          <tr>
            <td
              colSpan={2}
              className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("Kununua vifaa", "Investing")}
            </td>
          </tr>
          {line(t("Vifaa vilivyonunuliwa", "Equipment purchased"), cf.assetsPurchased)}

          <tr>
            <td
              colSpan={2}
              className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("Mtaji", "Financing")}
            </td>
          </tr>
          {line(t("Mmiliki alichochukua", "Owner drawings"), cf.ownerDrawings)}
          {line(t("Mtaji ulioingizwa", "Capital introduced"), cf.capitalIntroduced)}

          <Total
            label={t("Mabadiliko halisi ya fedha", "Net change in cash")}
            value={cf.netChange}
            strong
          />
          {line(t("Fedha mwanzoni", "Cash at the start"), cf.openingCash, true)}
          {line(t("Fedha mwishoni", "Cash at the end"), cf.closingCash, true)}
        </tbody>
      </table>

      {Math.abs(cf.unexplained) >= 0.01 ? (
        <div className="mt-3 rounded-xl border border-[#E11B22]/40 bg-[#E11B22]/10 px-3 py-2.5 text-[11px] text-[#E11B22]">
          {t(
            `Kuna tofauti ya ${tzs(cf.unexplained)} isiyoelezeka kati ya hesabu hii na fedha halisi. Hii inaonyeshwa badala ya kufichwa.`,
            `There is ${tzs(cf.unexplained)} of unexplained difference between this statement and the actual cash movement. It is shown rather than hidden.`,
          )}
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t(
            "Hesabu hii inalingana kabisa na fedha halisi iliyoingia na kutoka.",
            "This statement ties exactly to the cash that actually moved.",
          )}
        </div>
      )}
    </SectionCard>
  );
}

// The fixed-asset register plus this month's depreciation. Buying a van is
// not a cost, it is swapping cash for something worth the same; the cost is
// the value it loses each month, which is what gets posted here.
function FixedAssetsTab({ month, monthLabel }: { month: string; monthLabel: string }) {
  const { t, lang, can } = useApp();
  const canWrite = can("finance:write");
  const { data: rows = [], isPending } = useAssetSchedule(month);
  const post = usePostDepreciation();

  const monthCharge = rows.reduce((s, r) => s + r.chargeTZS, 0);
  const totalCost = rows.reduce((s, r) => s + r.costTZS, 0);
  const totalBook = rows.reduce((s, r) => s + r.bookValueTZS, 0);
  const nameOf = (r: { name: string; swName: string }) => (lang === "sw" ? r.swName : r.name);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label={t("Gharama ya awali", "Original cost")}
          value={tzs(totalCost)}
          accent="info"
        />
        <StatCard
          label={t("Thamani ya sasa", "Current book value")}
          value={tzs(totalBook)}
          accent="green"
        />
        <StatCard
          label={t("Uchakavu wa mwezi", "This month's depreciation")}
          value={tzs(monthCharge)}
          accent="amber"
        />
      </div>

      <SectionCard
        title={t("Daftari la mali", "Asset register")}
        action={
          <div className="flex items-center gap-2">
            {canWrite && monthCharge > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={post.isPending}
                onClick={() =>
                  post.mutate(month, {
                    onSuccess: (r) =>
                      toast.success(
                        r.posted > 0
                          ? t(
                              `Uchakavu wa ${tzs(r.amount)} umewekwa vitabuni`,
                              `Posted ${tzs(r.amount)} of depreciation`,
                            )
                          : t("Mwezi huu ulikuwa tayari umewekwa", "This month was already posted"),
                      ),
                    onError: () =>
                      toast.error(t("Imeshindikana kuweka", "Could not post depreciation")),
                  })
                }
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${post.isPending ? "animate-spin" : ""}`}
                />
                {t("Weka uchakavu wa mwezi", "Post this month's depreciation")}
              </Button>
            )}
            {canWrite && <AddAssetSheet />}
          </div>
        }
      >
        {isPending ? (
          <TableSkeleton rows={4} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={t("Hakuna mali za kudumu bado", "No fixed assets yet")}
            description={t(
              "Ongeza gari, friji au kifaa chochote kinachodumu zaidi ya mwaka.",
              "Add a van, chiller or anything else that lasts more than a year.",
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Mali", "Asset")}</th>
                  <th>{t("Ilianza kutumika", "In service")}</th>
                  <th className="text-right">{t("Gharama", "Cost")}</th>
                  <th className="text-right">{t("Uchakavu wa mwezi", "Monthly")}</th>
                  <th className="text-right">{t("Uchakavu wote", "Accumulated")}</th>
                  <th className="text-right px-3">{t("Thamani ya sasa", "Book value")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-medium">{nameOf(r)}</td>
                    <td className="py-2.5 font-num text-xs text-muted-foreground">
                      {r.inServiceOn} · {r.usefulLifeMonths} {t("miezi", "mo")}
                    </td>
                    <td className="py-2.5 text-right font-num">{tzs(r.costTZS, false)}</td>
                    <td className="py-2.5 text-right font-num">
                      {r.chargeTZS > 0 ? tzs(r.chargeTZS, false) : "-"}
                    </td>
                    <td className="py-2.5 text-right font-num text-muted-foreground">
                      {tzs(r.accumulatedTZS, false)}
                    </td>
                    <td className="py-2.5 text-right px-3 font-num font-semibold">
                      {tzs(r.bookValueTZS, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-[11px] text-muted-foreground">
          {t(
            `Uchakavu unagawanywa sawa kwa kila mwezi wa maisha ya mali. Mwezi wa mwisho unachukua senti zilizobaki, ili mali imalizie hasa kwenye thamani yake ya mwisho. Unaonyesha ${monthLabel}.`,
            `Depreciation is spread evenly across the asset's life. The final month absorbs the rounding, so an asset lands exactly on its salvage value rather than a few shillings off. Showing ${monthLabel}.`,
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function AddAssetSheet() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [swName, setSwName] = useState("");
  const [cost, setCost] = useState(0);
  const [acquired, setAcquired] = useState(todayISO());
  const [inService, setInService] = useState(todayISO());
  const [years, setYears] = useState(5);
  const [salvage, setSalvage] = useState(0);
  const create = useCreateAsset();

  const save = () => {
    if (!name.trim() || cost <= 0) return;
    if (salvage >= cost) {
      toast.error(
        t(
          "Thamani ya mwisho lazima iwe chini ya gharama",
          "Salvage value must be less than the cost",
        ),
      );
      return;
    }
    create.mutate(
      {
        name,
        swName,
        category: "equipment",
        costTZS: cost,
        acquiredOn: acquired,
        inServiceOn: inService,
        usefulLifeMonths: Math.max(1, Math.round(years * 12)),
        salvageTZS: salvage,
      },
      {
        onSuccess: () => {
          toast.success(t("Mali imeongezwa", "Asset added"));
          setOpen(false);
          setName("");
          setSwName("");
          setCost(0);
          setSalvage(0);
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add the asset")),
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
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Mali mpya", "Add asset")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Ongeza mali ya kudumu", "Add a fixed asset")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Kitu kinachodumu zaidi ya mwaka: gari, friji, mashine. Kununua siyo gharama, gharama ni kupungua kwa thamani kila mwezi.",
              "Something that lasts more than a year: a van, a chiller, a machine. Buying it is not a cost, the cost is the value it loses each month.",
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Jina", "Name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Delivery van"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Jina kwa Kiswahili", "Swahili name")}</Label>
            <Input
              value={swName}
              onChange={(e) => setSwName(e.target.value)}
              placeholder="Gari la usambazaji"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Gharama (TZS)", "Cost (TZS)")}</Label>
              <Input
                type="number"
                step="any"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="font-num"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Thamani ya mwisho", "Salvage value")}</Label>
              <Input
                type="number"
                step="any"
                value={salvage}
                onChange={(e) => setSalvage(Number(e.target.value))}
                className="font-num"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Ilinunuliwa", "Acquired on")}</Label>
              <Input type="date" value={acquired} onChange={(e) => setAcquired(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Ilianza kutumika", "In service from")}</Label>
              <Input type="date" value={inService} onChange={(e) => setInService(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Itadumu miaka mingapi", "Useful life (years)")}</Label>
            <Input
              type="number"
              step="any"
              min={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="font-num"
            />
            {cost > 0 && years > 0 && salvage < cost && (
              <div className="text-[11px] text-muted-foreground">
                {t("Uchakavu wa kila mwezi", "Monthly depreciation")}:{" "}
                <span className="font-num font-semibold">
                  {tzs((cost - salvage) / Math.max(1, Math.round(years * 12)))}
                </span>
              </div>
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={create.isPending || !name.trim() || cost <= 0}>
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Opening balances: what the business already had on the day the books
// open. Hybrid by design, the figures the system knows for certain are
// offered as a pre-fill, the rest (cash, bank, equipment) only exist
// outside the system and have to be typed.
//
// Owner capital is deliberately not an input. It is whatever the assets
// exceed the liabilities by, so the system derives it; typing it would
// invite a figure that does not reconcile.
const OPENING_FIELDS: {
  code: string;
  sw: string;
  en: string;
  group: "asset" | "liability";
  suggest?: "receivables" | "farmerPayables";
}[] = [
  { code: "1000", sw: "Fedha mkononi", en: "Cash on hand", group: "asset" },
  { code: "1010", sw: "Benki", en: "Bank", group: "asset" },
  { code: "1020", sw: "M-Pesa", en: "M-Pesa", group: "asset" },
  {
    code: "1100",
    sw: "Madeni ya wateja",
    en: "Customers owe us",
    group: "asset",
    suggest: "receivables",
  },
  { code: "1210", sw: "Thamani ya ghala", en: "Stock value", group: "asset" },
  { code: "1500", sw: "Mali na vifaa", en: "Property and equipment", group: "asset" },
  {
    code: "1510",
    sw: "Uchakavu uliokusanywa",
    en: "Accumulated depreciation",
    group: "asset",
  },
  {
    code: "2000",
    sw: "Tunadaiwa na wafugaji",
    en: "We owe farmers",
    group: "liability",
    suggest: "farmerPayables",
  },
  { code: "2010", sw: "Tunadaiwa na wauzaji", en: "We owe suppliers", group: "liability" },
];

function OpeningBalancesTab() {
  const { t } = useApp();
  const { data: existing } = useOpeningBalances();
  const { data: suggested } = useSuggestedOpening();
  const save = useSetOpeningBalances();
  const canWrite = useApp().can("finance:write");

  const [date, setDate] = useState("");
  const [values, setValues] = useState<Record<string, number>>({});
  // Seeded from whatever is already saved, once, so an edit starts from
  // the real figures instead of an empty form.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && existing) {
    setSeeded(true);
    setDate(existing.date ?? todayISO());
    const v: Record<string, number> = {};
    for (const l of existing.lines) if (l.code !== "3000") v[l.code] = l.amount;
    setValues(v);
  }

  const assets = OPENING_FIELDS.filter((f) => f.group === "asset");
  const liabilities = OPENING_FIELDS.filter((f) => f.group === "liability");
  // Accumulated depreciation is a contra-asset: it reduces what the
  // equipment is worth, so it subtracts here rather than adding.
  const totalAssets = assets.reduce(
    (s, f) => s + (f.code === "1510" ? -(values[f.code] ?? 0) : (values[f.code] ?? 0)),
    0,
  );
  const totalLiabilities = liabilities.reduce((s, f) => s + (values[f.code] ?? 0), 0);
  const ownerCapital = totalAssets - totalLiabilities;

  const prefill = () => {
    if (!suggested) return;
    setValues((v) => ({
      ...v,
      1100: suggested.receivables,
      2000: suggested.farmerPayables,
    }));
    toast.success(t("Tumejaza tunachokijua", "Filled in what we already know"));
  };

  const submit = () => {
    if (!date) return;
    save.mutate(
      {
        date,
        lines: OPENING_FIELDS.map((f) => ({ account: f.code, amount: values[f.code] ?? 0 })),
      },
      {
        onSuccess: () =>
          toast.success(t("Salio la kuanzia limehifadhiwa", "Opening balances saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save opening balances")),
      },
    );
  };

  const field = (f: (typeof OPENING_FIELDS)[number]) => (
    <div key={f.code} className="grid gap-1.5">
      <Label className="text-xs">
        <span className="font-num text-[10px] text-muted-foreground mr-1.5">{f.code}</span>
        {t(f.sw, f.en)}
      </Label>
      <Input
        type="number"
        step="any"
        disabled={!canWrite}
        value={values[f.code] ?? ""}
        placeholder="0"
        onChange={(e) => setValues((v) => ({ ...v, [f.code]: Number(e.target.value) || 0 }))}
        className="font-num"
      />
    </div>
  );

  return (
    <SectionCard
      title={t("Salio la kuanzia", "Opening balances")}
      action={
        canWrite && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={prefill}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            {t("Jaza tunachokijua", "Fill what we know")}
          </Button>
        )
      }
    >
      <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground mb-4">
        {t(
          "Hii ni hali ya biashara siku vitabu vinaanza: fedha, benki, vifaa na madeni yaliyokuwepo kabla ya mfumo. Bila hii, mizania inaonyesha tu yaliyotokea ndani ya mfumo.",
          "This is where the business stood on the day the books open: the cash, bank, equipment and debts that existed before the system. Without it the balance sheet only shows what happened inside the system.",
        )}
      </div>

      <div className="grid gap-1.5 max-w-xs mb-4">
        <Label className="text-xs">{t("Vitabu vinaanza tarehe", "Books open as at")}</Label>
        <Input
          type="date"
          value={date}
          disabled={!canWrite}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("Tulichokuwa nacho", "What we had")}
          </div>
          <div className="grid gap-3">{assets.map(field)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("Tuliyokuwa tunadaiwa", "What we owed")}
          </div>
          <div className="grid gap-3">{liabilities.map(field)}</div>

          <div
            className="mt-5 rounded-xl border-2 p-3.5 bg-[#F4F6F2]"
            style={{ borderColor: "#1E6B3A" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {t("Mtaji wa mmiliki", "Owner capital")}
              </span>
              <span className="font-num font-bold text-lg">{tzs(ownerCapital)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {t(
                "Inahesabiwa yenyewe: mali kasoro madeni. Hakuna cha kuandika hapa.",
                "Worked out for you: what you had less what you owed. Nothing to type here.",
              )}
            </div>
          </div>
        </div>
      </div>

      {canWrite && (
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={submit}
            disabled={save.isPending || !date}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {save.isPending
              ? t("Inahifadhi…", "Saving…")
              : t("Hifadhi salio la kuanzia", "Save opening balances")}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {t(
              "Kuhifadhi tena kunarekebisha, hakuongezi mara ya pili.",
              "Saving again corrects the figures, it does not add a second set.",
            )}
          </span>
        </div>
      )}
    </SectionCard>
  );
}

function Group({
  label,
  rows,
  nameOf,
}: {
  label: string;
  rows: LedgerAccount[];
  nameOf: (a: LedgerAccount) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </td>
      </tr>
      {rows.map((a) => (
        <tr key={a.code} className="border-b border-border last:border-0">
          <td className="py-2 pl-3">
            <span className="font-num text-xs text-muted-foreground mr-2">{a.code}</span>
            {nameOf(a)}
          </td>
          <td className="py-2 text-right pr-3 font-num">{tzs(a.amount, false)}</td>
        </tr>
      ))}
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr
      className={strong ? "border-t-2" : "border-t"}
      style={strong ? { borderColor: "#1E6B3A" } : undefined}
    >
      <td className={`py-2.5 pl-3 ${strong ? "font-bold" : "font-semibold"}`}>{label}</td>
      <td
        className={`py-2.5 text-right pr-3 font-num ${strong ? "font-bold text-base" : "font-semibold"}`}
        style={strong && value < 0 ? { color: "#E11B22" } : undefined}
      >
        {tzs(value, false)}
      </td>
    </tr>
  );
}

function VatRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <span>{label}</span>
      <span className="font-num font-semibold">{tzs(value)}</span>
    </li>
  );
}
