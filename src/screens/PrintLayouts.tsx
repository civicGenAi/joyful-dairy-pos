import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import {
  COMPANY,
  CUSTOMERS,
  FARMERS,
  PRICE_MATRIX,
  PRODUCTS,
  RECON_TODAY,
  TODAY_LABEL,
} from "@/mock/data";
import type { Customer, Farmer } from "@/mock/types";
import { L, kg, num, tzs } from "@/lib/format";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useApp } from "@/app/context";
import { Pill } from "@/components/ui/data-bits";

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
  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-5 py-3">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("Rudi", "Back")}
          </Link>
          <div className="text-sm font-semibold">{title}</div>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" /> {t("Chapisha", "Print")}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 print:p-0 print:max-w-none">
        <div className="rounded-2xl bg-card border border-border p-8 print:border-0 print:shadow-none print:rounded-none">
          <div className="flex items-center justify-between border-b border-border pb-5 mb-6">
            <JoyLogo size={48} />
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">{COMPANY.name}</div>
              <div>{COMPANY.city}</div>
              <div>{COMPANY.phone}</div>
              <div>{COMPANY.email}</div>
              <div className="mt-1">
                {COMPANY.tin} · {COMPANY.vrn}
              </div>
            </div>
          </div>
          <div className="mb-6">
            <div className="font-display text-2xl font-bold">{title}</div>
            {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          {children}
          <div className="mt-10 pt-5 border-t border-border text-center text-xs text-muted-foreground">
            {COMPANY.footer}
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

// ---- Receipt ----------------------------------------------------------------

export function ReceiptPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/receipt/$id" });
  // Demo: synthesise an internally-consistent receipt from the id.
  const lines = [
    { productId: "p-fresh", qty: 5, tier: "own" as const },
    { productId: "p-mtindi", qty: 3, tier: "own" as const },
    { productId: "p-yog-van", qty: 4, tier: "own" as const },
  ];
  const total = lines.reduce((a, l) => a + PRICE_MATRIX[l.productId][l.tier] * l.qty, 0);
  return (
    <PrintShell
      backTo="/pos"
      title={t("Risiti ya mauzo", "Sale receipt")}
      subtitle={`${id} · ${new Date().toLocaleString()}`}
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
          {lines.map((l, i) => {
            const p = PRODUCTS.find((x) => x.id === l.productId)!;
            const price = PRICE_MATRIX[l.productId][l.tier];
            return (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-2.5">
                  {p.name}
                  <span className="text-xs text-muted-foreground"> / {p.swName}</span>
                </td>
                <td className="py-2.5 text-right">
                  {l.qty} {p.unit}
                </td>
                <td className="py-2.5 text-right">{num(price)}</td>
                <td className="py-2.5 text-right font-semibold">{num(price * l.qty)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <td colSpan={3} className="py-3 text-right font-semibold">
              {t("Jumla", "Total")}
            </td>
            <td className="py-3 text-right font-bold text-lg">{tzs(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Aina ya malipo", "Payment")}
          </div>
          <div className="font-semibold">Cash</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mteja", "Customer")}
          </div>
          <div className="font-semibold">{t("Mteja wa kupita", "Walk-in")}</div>
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Customer statement -----------------------------------------------------

export function CustomerStatementPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/statement/customer/$id" });
  const c: Customer | undefined = CUSTOMERS.find((x) => x.id === id);
  const month =
    (useSearch({ from: "/statement/customer/$id" }) as { month?: string }).month ?? "May 2026";
  if (!c)
    return (
      <PrintShell backTo="/customers" title="Customer not found">
        <div>No customer with id {id}.</div>
      </PrintShell>
    );

  const takings = (c.monthlyActivity ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const deposits = (c.deposits ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const opening = 0;
  const closing = opening + takings - deposits;

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
          {(c.monthlyActivity ?? []).map((a) => {
            const p = PRODUCTS.find((x) => x.id === a.productId);
            return (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="py-1.5 text-xs">{a.date}</td>
                <td className="py-1.5">{p?.name}</td>
                <td className="py-1.5 text-right">
                  {a.qty} {a.unit}
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
          <span className="font-num text-[#E11B22]">-{tzs(deposits)}</span>
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

export function FarmerStatementPrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/statement/farmer/$id" });
  const f: Farmer | undefined = FARMERS.find((x) => x.id === id);
  if (!f)
    return (
      <PrintShell backTo="/farmers" title="Farmer not found">
        <div>No farmer with id {id}.</div>
      </PrintShell>
    );
  const daily = Array.from({ length: 15 }).map((_, i) => {
    const litres = Math.round(8 + (((i + parseInt(f.id.slice(1)) || 0) * 7) % 35));
    return {
      date: `2026-05-${String(14 + i).padStart(2, "0")}`,
      session: i % 2 === 0 ? "morning" : "evening",
      litres,
    };
  });
  const total = daily.reduce((a, d) => a + d.litres, 0);
  const earnings = total * f.ratePerL;

  return (
    <PrintShell
      backTo="/farmers"
      title={t("Statimenti ya mfugaji", "Farmer statement")}
      subtitle={`${f.name} · ${f.village} · ${t("Mzunguko", "Cycle")} 01-15 Jun 2026`}
    >
      <div className="grid grid-cols-3 gap-3 mb-6 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Bei", "Rate")}
          </div>
          <div className="font-num font-semibold">{num(f.ratePerL)}/L</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Litre", "Litres")}
          </div>
          <div className="font-num font-semibold">{L(total)}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Kiasi", "Earnings")}
          </div>
          <div className="font-num font-semibold text-[#1E7C3F]">{tzs(earnings)}</div>
        </div>
      </div>

      <table className="w-full text-sm font-num">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2">{t("Tarehe", "Date")}</th>
            <th>{t("Kipindi", "Session")}</th>
            <th className="text-right">{t("Litre", "Litres")}</th>
            <th className="text-right">{t("Kiasi", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date + d.session} className="border-b border-border last:border-0">
              <td className="py-1.5 text-xs">{d.date}</td>
              <td className="py-1.5 capitalize">{d.session}</td>
              <td className="py-1.5 text-right">{d.litres}</td>
              <td className="py-1.5 text-right">{num(d.litres * f.ratePerL)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <td colSpan={2} className="py-3 font-semibold">
              {t("Jumla", "Total")}
            </td>
            <td className="py-3 text-right font-bold">{total} L</td>
            <td className="py-3 text-right font-bold text-[#1E7C3F]">{tzs(earnings)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-6 text-sm grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Malipo ya mwisho", "Last payment")}
          </div>
          <div className="font-num font-semibold">{tzs(f.lastPaymentTZS)}</div>
          <div className="text-xs text-muted-foreground">{f.lastPaymentDate}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Inayodaiwa", "Outstanding payable")}
          </div>
          <div className="font-num font-semibold text-[#E11B22]">{tzs(f.currentBalanceTZS)}</div>
        </div>
      </div>
    </PrintShell>
  );
}

// ---- Day-close report -------------------------------------------------------

export function DayCloseReportScreen() {
  const { t } = useApp();
  const { date } = useParams({ from: "/report/day-close/$date" });
  return (
    <PrintShell
      backTo="/reconciliation"
      title={t("Ripoti ya kufunga siku", "Day-close report")}
      subtitle={`${date} · ${TODAY_LABEL}`}
    >
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
          {RECON_TODAY.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="py-2 px-2 font-sans font-medium">{r.product}</td>
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
          <div className="font-semibold">Daudi Massawe</div>
          <div className="text-xs text-muted-foreground">
            Production Manager · {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Imethibitishwa na", "Confirmed by")}
          </div>
          <div className="font-semibold">Asha Mwakasege</div>
          <div className="text-xs text-muted-foreground">
            Finance · {new Date().toLocaleTimeString()}
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
  const amount = 540000;
  return (
    <PrintShell backTo="/finance" title={t("Risiti ya amana", "Deposit slip")} subtitle={`${id}`}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Chanzo", "Source")}
          </div>
          <div className="font-semibold">Route van #1, Baraka Laizer</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Aina", "Type")}
          </div>
          <div className="font-semibold">Route cash-up</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 col-span-2 text-center py-6">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Kiasi", "Amount")}
          </div>
          <div className="font-num text-4xl font-bold mt-1 text-[#1E7C3F]">{tzs(amount)}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, mleta", "Signature, depositor")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">
            Baraka Laizer
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, mpokeaji", "Signature, receiver")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">
            Asha Mwakasege, Finance
          </div>
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
  const cycle = search.cycle ?? "01-15 Jun 2026";
  const f: Farmer | undefined = FARMERS.find((x) => x.id === id);

  if (!f) {
    return (
      <PrintShell backTo="/farmers" title="Farmer not found">
        <div>No farmer with id {id}.</div>
      </PrintShell>
    );
  }

  // For demo, the payout amount is the farmer's current balance.
  const litres = Math.round(f.litresThisCycle / 2); // litres earned in this cycle
  const gross = litres * f.ratePerL;
  const deductions = Math.round(gross * 0.02); // 2% Sacco contribution, demo
  const net = gross - deductions;

  return (
    <PrintShell
      backTo="/farmers"
      title={t("Karatasi ya malipo", "Payout slip")}
      subtitle={`${f.name} · ${f.village} · ${cycle}`}
    >
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mfugaji", "Farmer")}
          </div>
          <div className="font-semibold">{f.name}</div>
          <div className="text-xs text-muted-foreground">{f.phone}</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Mzunguko", "Cycle")}
          </div>
          <div className="font-semibold">{cycle}</div>
          <div className="text-xs text-muted-foreground">{f.village}</div>
        </div>
      </div>

      <table className="w-full text-sm font-num">
        <tbody>
          <tr className="border-b border-border">
            <td className="py-2.5 text-muted-foreground">
              {t("Litre zilizokusanywa", "Litres collected")}
            </td>
            <td className="py-2.5 text-right">{litres} L</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2.5 text-muted-foreground">{t("Bei", "Rate")}</td>
            <td className="py-2.5 text-right">{num(f.ratePerL)} / L</td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2.5 font-sans text-muted-foreground">{t("Jumla ghafi", "Gross")}</td>
            <td className="py-2.5 text-right font-semibold">{tzs(gross)}</td>
          </tr>
          <tr className="border-b border-border text-[#E11B22]">
            <td className="py-2.5 font-sans">
              {t("Mchango wa Sacco (2%)", "Sacco contribution (2%)")}
            </td>
            <td className="py-2.5 text-right">-{tzs(deductions)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <td className="py-3 font-sans font-bold text-base">
              {t("Malipo halisi", "Net payable")}
            </td>
            <td className="py-3 text-right font-bold text-base text-[#1E7C3F]">{tzs(net)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Njia ya malipo", "Pay method")}
          </div>
          <div className="font-semibold">M-Pesa</div>
          <div className="text-xs text-muted-foreground">{f.phone}</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Hali", "Status")}
          </div>
          <div className="font-semibold capitalize">{f.status}</div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, mfugaji", "Farmer signature")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">{f.name}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-8">
            {t("Saini, Finance", "Finance signature")}
          </div>
          <div className="border-t border-border pt-1 text-xs text-muted-foreground">
            Asha Mwakasege
          </div>
        </div>
      </div>
    </PrintShell>
  );
}
