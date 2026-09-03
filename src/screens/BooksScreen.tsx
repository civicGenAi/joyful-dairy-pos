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
} from "@/lib/data/hooks/ledger";
import type { LedgerAccount } from "@/lib/data/ledger";
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { tzs } from "@/lib/format";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { ChevronLeft, ChevronRight, BookOpen, RefreshCw, Scale } from "lucide-react";
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
            <TabsTrigger value="vat">{t("VAT", "VAT return")}</TabsTrigger>
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
                <ExportMenu
                  formats={["csv", "excel", "pdf"]}
                  filename={`trial-balance-${viewMonth}`}
                  data={() => ({
                    title: t(`Salio la majaribio, ${monthLabel}`, `Trial balance, ${monthLabel}`),
                    headers: ["Code", "Account", "Debit", "Credit"],
                    rows: tb.map((a) => [a.code, nameOf(a), a.debit ?? 0, a.credit ?? 0]),
                  })}
                />
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
        </Tabs>
      )}
    </AppShell>
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
