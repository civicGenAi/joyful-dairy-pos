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
import { todayISO } from "@/lib/data/dates";
import { SectionCard, StatCard, Pill } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tzs } from "@/lib/format";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
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
