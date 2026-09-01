import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
// BACKEND: print pages render live records via src/lib/data hooks.
import { useSale, useDeposit } from "@/lib/data/hooks/sales";
import { useProducts } from "@/lib/data/hooks/products";
import {
  useCustomer,
  useCustomerActivities,
  useCustomerDeposits,
  useCustomerBalanceBefore,
} from "@/lib/data/hooks/customers";
import { useFarmer, useCycleSummary, useFarmerMonthlySummary } from "@/lib/data/hooks/farmers";
import { useDayLock, useReconForDate } from "@/lib/data/hooks/recon";
import { useCompany } from "@/lib/data/hooks/settings";
import { collectionKeys, collectionsRepo } from "@/lib/data/collections";
import { dateLabel, todayISO } from "@/lib/data/dates";
import { useQuery } from "@tanstack/react-query";
import { L, num, tzs } from "@/lib/format";
import { exportElementPDF } from "@/lib/export";
import { useRef, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useApp } from "@/app/context";

function PrintShell({
  backTo,
  title,
  subtitle,
  children,
}: {
  backTo: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  const { data: company } = useCompany();
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Real PDF file of the document, not the browser print dialog.
  const downloadPDF = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(subtitle ?? "").split(" ")[0] || Date.now()}`;
      await exportElementPDF(docRef.current, name);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-2 px-5 py-3">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("Rudi", "Back")}
          </Link>
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="flex items-center gap-2">
            <Button
              onClick={downloadPDF}
              size="sm"
              disabled={downloading}
              className="text-xs text-white"
              style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {downloading ? t("Inapakua…", "Downloading…") : t("Pakua PDF", "Download PDF")}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 print:p-0 print:max-w-none">
        <div
          ref={docRef}
          className="rounded-2xl bg-card border border-border p-8 print:border-0 print:shadow-none print:rounded-none"
        >
          <div className="flex items-center justify-between border-b border-border pb-5 mb-6">
            <JoyLogo size={48} />
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">
                {company?.name ?? "African Joy Dairy"}
              </div>
              <div>{company?.city ?? ""}</div>
              <div>{company?.phone ?? ""}</div>
              <div>{company?.email ?? ""}</div>
              <div className="mt-1">
                {company?.tin ?? ""} · {company?.vrn ?? ""}
              </div>
            </div>
          </div>
          <div className="mb-6">
            <div className="font-display text-2xl font-bold">{title}</div>
            {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          {children}
          <div className="mt-10 pt-5 border-t border-border text-center text-xs text-muted-foreground">
            {company?.footer ?? ""}
          </div>
        </div>
      </main>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function PrintLoading({ backTo, title }: { backTo: string; title: string }) {
  const { t } = useApp();
  return (
    <PrintShell backTo={backTo} title={title}>
      <div className="py-12 text-center text-sm text-muted-foreground">
        {t("Inapakia…", "Loading…")}
      </div>
    </PrintShell>
  );
}

// ---- Receipt ----------------------------------------------------------------

export function ReceiptPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/receipt/$id" });
  const { data: sale, isPending } = useSale(id);
  const { data: products = [] } = useProducts();

  if (isPending) return <PrintLoading backTo="/pos" title={t("Risiti ya mauzo", "Sale receipt")} />;
  if (!sale) {
    return (
      <PrintShell backTo="/pos" title={t("Risiti haipatikani", "Receipt not found")}>
        <div className="text-sm text-muted-foreground">
          {t("Hakuna risiti yenye namba", "No receipt with id")} {id}.
        </div>
      </PrintShell>
    );
  }

  const lines = sale.lines ?? [];
  return (
    <PrintShell
      backTo="/pos"
      title={t("Risiti ya mauzo", "Sale receipt")}
      subtitle={`${sale.id} · ${new Date(sale.at).toLocaleString()}`}
    >
      <table className="w-full text-sm font-num">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2">{t("Bidhaa", "Item")}</th>
            <th className="text-right">{t("Idadi", "Qty")}</th>
            <th className="text-right">{t("Bei", "Price")}</th>
            <th className="text-right">{t("Jumla", "Total")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const p = products.find((x) => x.id === l.productId);
            return (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="py-2.5">
                  {p?.name ?? l.productId}
                  {p?.swName && (
                    <span className="text-xs text-muted-foreground"> / {p.swName}</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {num(l.qty)} {l.unit}
                </td>
                <td className="py-2.5 text-right">{num(l.unitPrice)}</td>
                <td className="py-2.5 text-right font-semibold">{num(l.amountTZS)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <td colSpan={3} className="py-3 text-right font-semibold">
              {t("Jumla", "Total")}
            </td>
            <td className="py-3 text-right font-bold text-lg">{tzs(sale.totalTZS)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Aina ya malipo", "Payment")}
          </div>
          <div className="font-semibold capitalize">{sale.payment}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mteja", "Customer")}
          </div>
          <div className="font-semibold">
            {sale.customerName ?? t("Mteja wa kupita", "Walk-in")}
          </div>
          {sale.soldByName && (
            <div className="text-xs text-muted-foreground">
              {t("Muuzaji", "Served by")}: {sale.soldByName}
            </div>
          )}
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Customer statement -----------------------------------------------------

export function CustomerStatementPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/statement/customer/$id" });
  const search = useSearch({ from: "/statement/customer/$id" }) as { month?: string };
  const month =
    search.month ?? new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  // "1 May 2026" parses reliably to the first of that month, giving the
  // date customer_balance_before() needs to compute what was actually
  // owed walking into this month, instead of assuming it was always zero.
  const monthStartDate = new Date(`1 ${month}`);
  const monthStartIso = Number.isNaN(monthStartDate.getTime())
    ? null
    : `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: c, isPending } = useCustomer(id);
  const { data: activities = [] } = useCustomerActivities(id);
  const { data: deposits = [] } = useCustomerDeposits(id);
  const { data: products = [] } = useProducts();
  const { data: balanceBefore = 0 } = useCustomerBalanceBefore(id, monthStartIso);

  if (isPending)
    return (
      <PrintLoading backTo="/customers" title={t("Statimenti ya mwezi", "Monthly statement")} />
    );
  if (!c)
    return (
      <PrintShell backTo="/customers" title={t("Mteja hapatikani", "Customer not found")}>
        <div className="text-sm text-muted-foreground">
          {t("Hakuna mteja mwenye namba", "No customer with id")} {id}.
        </div>
      </PrintShell>
    );

  const monthLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const monthActivities = activities.filter((a) => monthLabel(a.date) === month);
  const monthDeposits = deposits.filter((d) => monthLabel(d.date) === month);
  const shown = monthActivities.length ? monthActivities : activities;
  const shownDeposits = monthActivities.length ? monthDeposits : deposits;

  const takings = shown.reduce((a, x) => a + x.amountTZS, 0);
  const depositTotal = shownDeposits.reduce((a, x) => a + x.amountTZS, 0);
  // Only apply a real opening balance when actually showing one specific
  // month; the "no activity this month" fallback already shows the whole
  // history, where 0 is the correct starting point.
  const opening = monthActivities.length ? balanceBefore : 0;
  const closing = opening + takings - depositTotal;

  return (
    <PrintShell
      backTo="/customers"
      title={t("Statimenti ya mwezi", "Monthly statement")}
      subtitle={`${c.name} · ${month}`}
    >
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mteja", "Customer")}
          </div>
          <div className="font-semibold">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.phone}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Aina", "Type")}
          </div>
          <div className="font-semibold capitalize">{c.type}</div>
          <div className="text-xs text-muted-foreground">
            {t("Salio la sasa", "Current balance")}: {tzs(c.outstandingTZS)}
          </div>
        </div>
      </div>

      <table className="w-full text-sm font-num">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2">{t("Tarehe", "Date")}</th>
            <th>{t("Bidhaa", "Product")}</th>
            <th className="text-right">{t("Idadi", "Qty")}</th>
            <th className="text-right">{t("Bei", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => {
            const p = products.find((x) => x.id === a.productId);
            return (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="py-1.5 text-xs">{a.date}</td>
                <td className="py-1.5">{p?.name ?? a.productId}</td>
                <td className="py-1.5 text-right">
                  {num(a.qty)} {a.unit}
                </td>
                <td className="py-1.5 text-right">{num(a.amountTZS)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between border-b border-border py-2">
          <span>{t("Salio la awali", "Opening balance")}</span>
          <span className="font-num">{tzs(opening)}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2">
          <span>{t("Manunuzi", "Total takings")}</span>
          <span className="font-num text-[#1E7C3F]">+{tzs(takings)}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2">
          <span>{t("Amana", "Deposits")}</span>
          <span className="font-num text-[#E11B22]">-{tzs(depositTotal)}</span>
        </div>
        <div className="flex justify-between border-b border-border py-2 font-bold">
          <span>{t("Salio la mwisho", "Closing balance")}</span>
          <span className="font-num">{tzs(closing)}</span>
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Farmer statement -------------------------------------------------------

const STATUS_LABEL: Record<string, { sw: string; en: string }> = {
  paid: { sw: "Imelipwa", en: "Paid" },
  partial: { sw: "Sehemu", en: "Partial" },
  unpaid: { sw: "Haijalipwa", en: "Unpaid" },
  none: { sw: "Hakuna", en: "None" },
};

const STATUS_COLOR: Record<string, string> = {
  paid: "#1E7C3F",
  partial: "#E5A100",
  unpaid: "#E11B22",
  none: "#6B776E",
};

export function FarmerStatementPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/statement/farmer/$id" });
  const search = useSearch({ from: "/statement/farmer/$id" }) as { month?: string };
  const monthStart = search.month ?? `${todayISO().slice(0, 8)}01`;
  const monthEnd = new Date(
    new Date(`${monthStart}T00:00:00`).getFullYear(),
    new Date(`${monthStart}T00:00:00`).getMonth() + 1,
    0,
  )
    .toISOString()
    .slice(0, 10);
  const { data: f, isPending } = useFarmer(id);
  const { data: monthly = [] } = useFarmerMonthlySummary(id, 24);
  const thisMonth = monthly.find((m) => m.month === monthStart);
  const { data: collections = [] } = useQuery({
    queryKey: [...collectionKeys.byFarmer(id, monthStart), monthEnd],
    queryFn: () => collectionsRepo.listByFarmer(id, monthStart, monthEnd),
  });

  if (isPending)
    return (
      <PrintLoading backTo="/farmers" title={t("Statimenti ya mfugaji", "Farmer statement")} />
    );
  if (!f)
    return (
      <PrintShell backTo="/farmers" title={t("Mfugaji hapatikani", "Farmer not found")}>
        <div className="text-sm text-muted-foreground">
          {t("Hakuna mfugaji mwenye namba", "No farmer with id")} {id}.
        </div>
      </PrintShell>
    );

  const total = thisMonth?.litres ?? collections.reduce((a, d) => a + d.litres, 0);
  const earnings = thisMonth?.earnedTZS ?? total * f.ratePerL;
  const paid = thisMonth?.paidTZS ?? 0;
  const status = thisMonth?.status ?? "none";
  const monthLabel = new Date(`${monthStart}T00:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const statusColor = STATUS_COLOR[status] ?? "#6B776E";

  return (
    <PrintShell
      backTo="/farmers"
      title={t("Statimenti ya mfugaji", "Farmer statement")}
      subtitle={monthLabel}
    >
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 mb-6">
        <div>
          <div className="font-display text-lg font-bold">{f.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {f.village} · {f.phone}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Bei kwa lita", "Rate per litre")}
          </div>
          <div className="font-num font-semibold">{tzs(f.ratePerL)}/L</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6 text-sm">
        {[
          { label: t("Litre", "Litres"), value: L(total), color: "#2F9E44" },
          { label: t("Alipata", "Earned"), value: tzs(earnings), color: "#1E7C3F" },
          { label: t("Alilipwa", "Paid"), value: tzs(paid), color: "#1D9E75" },
          {
            label: t("Hali", "Status"),
            value: t(STATUS_LABEL[status].sw, STATUS_LABEL[status].en),
            color: statusColor,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="h-1" style={{ background: card.color }} />
            <div className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {card.label}
              </div>
              <div className="font-num font-bold text-base mt-0.5" style={{ color: card.color }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {t("Ukusanyaji wa mwezi", "Collections this month")}
      </div>
      <table className="w-full text-sm font-num rounded-xl overflow-hidden border border-border">
        <thead>
          <tr
            className="text-left text-[11px] uppercase tracking-wider text-muted-foreground"
            style={{ background: "#E4EFE4" }}
          >
            <th className="py-2 px-3 font-sans">{t("Tarehe", "Date")}</th>
            <th className="font-sans">{t("Kipindi", "Session")}</th>
            <th className="text-right font-sans">{t("Litre", "Litres")}</th>
            <th className="text-right px-3 font-sans">{t("Kiasi", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {collections.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center font-sans text-muted-foreground">
                {t(
                  "Hakuna ukusanyaji uliorekodiwa mwezi huu.",
                  "No collections recorded this month yet.",
                )}
              </td>
            </tr>
          ) : (
            collections.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="py-1.5 px-3 text-xs">{d.date}</td>
                <td className="py-1.5 capitalize">{d.session}</td>
                <td className="py-1.5 text-right">{num(d.litres)}</td>
                <td className="py-1.5 px-3 text-right">
                  {num(d.litres * (d.ratePerL ?? f.ratePerL))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 mt-3 border-t-2"
        style={{ borderColor: "#1E6B3A", background: "#F4F6F2" }}
      >
        <div className="font-sans font-semibold">
          {t("Jumla ya mwezi", "Total this month")}
          <span className="ml-2 font-num text-muted-foreground text-sm">{num(total)} L</span>
        </div>
        <div className="font-num text-xl font-extrabold text-[#1E7C3F]">{tzs(earnings)}</div>
      </div>

      <div className="mt-6 text-sm grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Malipo ya mwisho", "Last payment")}
          </div>
          <div className="font-num font-semibold">{tzs(f.lastPaymentTZS)}</div>
          <div className="text-xs text-muted-foreground">{f.lastPaymentDate || "–"}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Inayodaiwa (jumla)", "Outstanding payable (overall)")}
          </div>
          <div className="font-num font-semibold text-[#E11B22]">{tzs(f.currentBalanceTZS)}</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
        <div>
          <div className="border-t border-border pt-1.5">
            {t("Sahihi ya mfugaji", "Farmer's signature")}
          </div>
        </div>
        <div>
          <div className="border-t border-border pt-1.5">
            {t("Sahihi ya wakala", "Agent's signature")}
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-[10px] text-muted-foreground">
        {t("Imetengenezwa tarehe", "Generated on")} {dateLabel(todayISO())}
      </div>
    </PrintShell>
  );
}

// ---- Day-close report -------------------------------------------------------

export function DayCloseReportScreen() {
  const { t } = useApp();
  const { date } = useParams({ from: "/report/day-close/$date" });
  const { data: lock, isPending: lockPending } = useDayLock(date);
  const { data: liveRows = [], isPending: livePending } = useReconForDate(date);
  const rows = lock ? lock.rows : liveRows;

  if (lockPending && livePending)
    return (
      <PrintLoading
        backTo="/reconciliation"
        title={t("Ripoti ya kufunga siku", "Day-close report")}
      />
    );

  return (
    <PrintShell
      backTo="/reconciliation"
      title={t("Ripoti ya kufunga siku", "Day-close report")}
      subtitle={`${date} · ${dateLabel(date)}`}
    >
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {t("Hakuna harakati zilizorekodiwa siku hii.", "No movements recorded for this date.")}
        </div>
      ) : (
        <table className="w-full text-sm font-num">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 px-2">{t("Bidhaa", "Product")}</th>
              <th className="text-right px-2">{t("Awali", "Open")}</th>
              <th className="text-right px-2">{t("Kusanywa", "Coll.")}</th>
              <th className="text-right px-2">{t("Tengeneza", "Prod.")}</th>
              <th className="text-right px-2">Cash</th>
              <th className="text-right px-2">Credit</th>
              <th className="text-right px-2">{t("Tenga", "Sep.")}</th>
              <th className="text-right px-2">{t("Haribika", "Spoilt")}</th>
              <th className="text-right px-2">{t("Rudi", "Ret.")}</th>
              <th className="text-right px-2">{t("Bakia", "Close")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-b border-border last:border-0">
                <td className="py-2 px-2 font-sans font-medium">
                  {r.product} ({r.unit})
                </td>
                <td className="py-2 px-2 text-right">{num(r.opening, r.opening % 1 ? 2 : 0)}</td>
                <td className="py-2 px-2 text-right">{num(r.collected)}</td>
                <td className="py-2 px-2 text-right">{num(r.produced, r.produced % 1 ? 2 : 0)}</td>
                <td className="py-2 px-2 text-right">{num(r.soldCash)}</td>
                <td className="py-2 px-2 text-right">{num(r.soldCredit)}</td>
                <td className="py-2 px-2 text-right">{num(r.separated)}</td>
                <td className="py-2 px-2 text-right text-[#E11B22]">{num(r.spoilt)}</td>
                <td className="py-2 px-2 text-right">{num(r.returned)}</td>
                <td className="py-2 px-2 text-right font-bold">
                  {num(r.closing, r.closing % 1 ? 2 : 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6 rounded-xl bg-[#1E7C3F]/10 p-4 text-sm">
        <div className="font-display font-semibold mb-1">
          {t("Kanuni ya usawazishaji", "Conservation rule")}
        </div>
        <div className="text-xs font-num text-[#14532D]">
          Opening + Collected + Produced = Sold cash + Sold credit + Separated + Spoilt + Returned +
          Closing
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Imefungwa na", "Locked by")}
          </div>
          <div className="font-semibold">
            {lock?.lockedByName ?? t("Bado haijafungwa", "Not locked yet")}
          </div>
          <div className="text-xs text-muted-foreground">
            {lock ? new Date(lock.lockedAt).toLocaleString() : ""}
          </div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Imethibitishwa na", "Confirmed by")}
          </div>
          <div className="font-semibold">
            {lock?.confirmedByName ?? (lock ? t("Inasubiri Finance", "Awaiting finance") : "·")}
          </div>
          <div className="text-xs text-muted-foreground">
            {lock?.confirmedAt ? new Date(lock.confirmedAt).toLocaleString() : ""}
          </div>
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Deposit slip -----------------------------------------------------------

export function DepositSlipPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/receipt/deposit/$id" });
  const { data: deposit, isPending } = useDeposit(id);

  if (isPending)
    return <PrintLoading backTo="/finance" title={t("Risiti ya amana", "Deposit slip")} />;
  if (!deposit)
    return (
      <PrintShell backTo="/finance" title={t("Amana haipatikani", "Deposit not found")}>
        <div className="text-sm text-muted-foreground">
          {t("Hakuna amana yenye namba", "No deposit with id")} {id}.
        </div>
      </PrintShell>
    );

  const sourceLabel =
    deposit.source === "route"
      ? t("Cash ya njia", "Route cash-up")
      : deposit.source === "pos"
        ? t("Cash benki", "Cash banking")
        : deposit.source === "customer"
          ? t("Amana ya mteja", "Customer deposit")
          : t("Nyingine", "Other");

  return (
    <PrintShell
      backTo="/finance"
      title={t("Risiti ya amana", "Deposit slip")}
      subtitle={`${deposit.id} · ${deposit.date}`}
    >
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Chanzo", "Source")}
          </div>
          <div className="font-semibold">{deposit.customerName ?? deposit.note ?? sourceLabel}</div>
          {deposit.ref && <div className="text-xs text-muted-foreground">{deposit.ref}</div>}
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Aina", "Type")}
          </div>
          <div className="font-semibold">{sourceLabel}</div>
          <div className="text-xs text-muted-foreground capitalize">{deposit.method}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 col-span-2 text-center py-6">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Kiasi", "Amount")}
          </div>
          <div className="font-num text-4xl font-bold mt-1 text-[#1E7C3F]">
            {tzs(deposit.amountTZS)}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, mleta", "Signature, depositor")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">
            {deposit.customerName ?? ""}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, mpokeaji", "Signature, receiver")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">Finance</div>
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Farmer payout slip ----------------------------------------------------

export function FarmerPayoutSlipScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/payout/farmer/$id" });
  const search = useSearch({ from: "/payout/farmer/$id" }) as { cycle?: string };
  const { data: f, isPending } = useFarmer(id);
  const { data: cycleData } = useCycleSummary();
  const cycle =
    search.cycle ??
    (cycleData
      ? `${dateLabel(cycleData.startDate)} - ${dateLabel(cycleData.endDate)}`
      : t("Mzunguko wa sasa", "Current cycle"));

  if (isPending)
    return <PrintLoading backTo="/farmers" title={t("Karatasi ya malipo", "Payout slip")} />;
  if (!f) {
    return (
      <PrintShell backTo="/farmers" title={t("Mfugaji hapatikani", "Farmer not found")}>
        <div className="text-sm text-muted-foreground">
          {t("Hakuna mfugaji mwenye namba", "No farmer with id")} {id}.
        </div>
      </PrintShell>
    );
  }

  const litres = f.litresThisCycle;
  // The authoritative figure is the farmer's actual accumulated balance,
  // not litres-this-cycle × today's rate: if the rate ever changed mid-
  // cycle that recalculation would drift from what was really earned.
  // current_balance_tzs is also the exact number record_payout() itself
  // validates a payment against, so it can never disagree with what's
  // actually payable. Farmers are paid in full, no deduction of any kind.
  const payable = f.currentBalanceTZS;
  const rateMayHaveChanged = Math.round(litres * f.ratePerL) !== Math.round(payable);

  return (
    <PrintShell backTo="/farmers" title={t("Karatasi ya malipo", "Payout slip")} subtitle={cycle}>
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3 mb-6">
        <div>
          <div className="font-display text-lg font-bold">{f.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {f.village} · {f.phone}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mzunguko", "Cycle")}
          </div>
          <div className="font-semibold text-sm">{cycle}</div>
        </div>
      </div>

      <table className="w-full text-sm font-num rounded-xl overflow-hidden border border-border">
        <tbody>
          <tr style={{ background: "#E4EFE4" }}>
            <td className="py-2.5 px-3 font-sans text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("Litre zilizokusanywa", "Litres collected")}
            </td>
            <td className="py-2.5 px-3 text-right font-semibold">{num(litres)} L</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-2.5 px-3 font-sans text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("Bei kwa lita", "Rate per litre")}
            </td>
            <td className="py-2.5 px-3 text-right font-semibold">{tzs(f.ratePerL)}/L</td>
          </tr>
        </tbody>
      </table>

      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 mt-3 border-t-2"
        style={{ borderColor: "#1E6B3A", background: "#F4F6F2" }}
      >
        <div className="font-sans font-bold text-base">
          {t("Kiasi cha kulipwa", "Amount payable")}
        </div>
        <div className="font-num text-2xl font-extrabold text-[#1E7C3F]">{tzs(payable)}</div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 text-center">
        {t(
          "Hakuna makato, mfugaji analipwa kiasi kamili.",
          "No deductions, the farmer is paid the full amount.",
        )}
      </div>
      {rateMayHaveChanged && (
        <div className="text-[11px] text-[#8a5a00] mt-1 text-center">
          {t(
            "Kumbuka: bei ilibadilika wakati wa mzunguko huu, kiasi hapo juu ni salio halisi la mfugaji.",
            "Note: the rate changed at some point during this cycle, the amount above is the farmer's real accumulated balance.",
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Malipo ya mwisho", "Last payment")}
          </div>
          <div className="font-semibold font-num">{tzs(f.lastPaymentTZS)}</div>
          <div className="text-xs text-muted-foreground">{f.lastPaymentDate || "–"}</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Hali", "Status")}
          </div>
          <div className="font-semibold capitalize">{f.status}</div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
        <div>
          <div className="border-t border-border pt-1.5">
            {t("Sahihi ya mfugaji", "Farmer's signature")}
          </div>
        </div>
        <div>
          <div className="border-t border-border pt-1.5">
            {t("Sahihi ya fedha", "Finance signature")}
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-[10px] text-muted-foreground">
        {t("Imetengenezwa tarehe", "Generated on")} {dateLabel(todayISO())}
      </div>
    </PrintShell>
  );
}
