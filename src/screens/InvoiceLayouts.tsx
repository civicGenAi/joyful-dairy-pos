import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { useApp } from "@/app/context";
import { useInvoice } from "@/lib/data/hooks/invoices";
import { useCustomer } from "@/lib/data/hooks/customers";
import { useCompany } from "@/lib/data/hooks/settings";
import { useQrDataUrl } from "@/lib/qr";
import { tzs, num } from "@/lib/format";
import { dateLabel } from "@/lib/data/dates";
import { exportElementPDF } from "@/lib/export";
import { useParams, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import type { Invoice, InvoiceLine } from "@/lib/data/invoices";
import type { CompanySettings } from "@/lib/data/settings";

// Both invoice kinds (one order vs. a period's bill) share this exact
// layout, only the BILL TO context and line items differ. Matches the
// reference template: company block top-left, logo top-right, BILL TO /
// invoice meta as a two-column header, a tinted line-items table, a
// prominent balance-due bar, and a "Pay by" box carrying the QR code.

function InvoiceChrome({
  backTo,
  invoiceId,
  children,
}: {
  backTo: string;
  invoiceId: string;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadPDF = async () => {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      await exportElementPDF(docRef.current, `invoice-${invoiceId}`);
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
          <div className="text-sm font-semibold truncate">{invoiceId}</div>
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
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 print:p-0 print:max-w-none">
        <div
          ref={docRef}
          className="rounded-2xl bg-white text-[#1a1a1a] border border-border p-10 print:border-0 print:shadow-none print:rounded-none"
        >
          {children}
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

function InvoiceDocument({
  company,
  billToName,
  billToSub,
  invoice,
  verifyUrl,
}: {
  company?: CompanySettings;
  billToName: string;
  billToSub: string[];
  invoice: Invoice;
  verifyUrl: string;
}) {
  const { t } = useApp();
  const qr = useQrDataUrl(verifyUrl);
  const lines: InvoiceLine[] = invoice.lines;

  return (
    <>
      <div className="flex items-start justify-between mb-10">
        <div className="text-xs leading-relaxed">
          <div className="font-bold text-sm">{company?.name ?? "African Joy Dairy"}</div>
          <div>{company?.city}</div>
          <div>{company?.phone}</div>
          <div>{company?.email}</div>
        </div>
        <JoyLogo size={44} />
      </div>

      <div className="font-display text-2xl font-bold text-[#1E7C3F] mb-6">
        {t("ANKARA", "INVOICE")}
      </div>

      <div className="flex items-start justify-between mb-6 text-xs">
        <div>
          <div className="uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
            {t("KWA", "BILL TO")}
          </div>
          <div className="font-semibold text-sm">{billToName}</div>
          {billToSub.map((s, i) => (
            <div key={i} className="text-muted-foreground">
              {s}
            </div>
          ))}
        </div>
        <div className="text-right">
          <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
              {t("ANKARA", "INVOICE")}
            </span>
            <span className="font-semibold font-num">{invoice.id}</span>
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
              {t("TAREHE", "DATE")}
            </span>
            <span className="font-num">{dateLabel(invoice.issuedAt.slice(0, 10))}</span>
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
              {t("MASHARTI", "TERMS")}
            </span>
            <span>{t(`Siku ${invoice.termsDays}`, `Net ${invoice.termsDays}`)}</span>
            <span className="uppercase tracking-wider text-[10px] text-muted-foreground">
              {t("MWISHO", "DUE DATE")}
            </span>
            <span className="font-num font-semibold">{dateLabel(invoice.dueDate)}</span>
          </div>
        </div>
      </div>

      <table className="w-full text-xs font-num mb-2">
        <thead>
          <tr className="text-left bg-[#E4EFE4] text-[10px] uppercase tracking-wider text-[#1E6B3A]">
            <th className="py-2 px-2 font-semibold">{t("TAREHE", "Date")}</th>
            <th className="py-2 px-2 font-semibold">{t("SHUGHULI", "Activity")}</th>
            <th className="py-2 px-2 font-semibold">{t("MAELEZO", "Description")}</th>
            <th className="py-2 px-2 text-right font-semibold">{t("IDADI", "Qty")}</th>
            <th className="py-2 px-2 text-right font-semibold">{t("BEI", "Rate")}</th>
            <th className="py-2 px-2 text-right font-semibold">{t("KIASI", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-dashed border-border">
              <td className="py-2 px-2">{dateLabel(l.date)}</td>
              <td className="py-2 px-2">{l.activity}</td>
              <td className="py-2 px-2 text-muted-foreground">{l.description}</td>
              <td className="py-2 px-2 text-right">
                {num(l.qty)} {l.unit}
              </td>
              <td className="py-2 px-2 text-right">{num(l.rate)}</td>
              <td className="py-2 px-2 text-right font-semibold">{num(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {invoice.kind === "bill" && (
        <div className="flex justify-end mb-2 text-xs">
          <div className="w-64 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("Salio la awali", "Opening balance")}
              </span>
              <span className="font-num">{tzs(invoice.openingTZS)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Amana", "Deposits")}</span>
              <span className="font-num">-{tzs(invoice.depositsTZS)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end items-center gap-4 border-t-2 border-[#1E6B3A] pt-3 mb-8">
        <span className="uppercase tracking-wider text-xs text-muted-foreground">
          {t("KIASI CHA KULIPA", "Balance due")}
        </span>
        <span className="font-num text-xl font-extrabold">{tzs(invoice.balanceDueTZS)}</span>
      </div>

      <div className="rounded-xl bg-[#F4F6F2] p-5 flex items-center justify-between gap-4">
        <div className="text-xs leading-relaxed">
          <div className="font-semibold mb-1">{t("Lipa kwa:", "Pay by:")}</div>
          {company?.mpesaLipaNamba && (
            <div>
              {t("M-PESA LIPA NAMBA", "M-PESA LIPA NAMBA")} {company.mpesaLipaNamba}
            </div>
          )}
          {company?.bankAccount && (
            <div>
              {company.bankName} {t("NAMBA YA AKAUNTI", "AC NO")} {company.bankAccount}
            </div>
          )}
        </div>
        {qr && (
          <div className="text-center shrink-0">
            <img src={qr} alt="Verification QR code" className="h-20 w-20" />
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
              <ShieldCheck className="h-2.5 w-2.5" />
              {t("Changanua kuthibitisha", "Scan to verify")}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InvoiceLoading({ backTo, invoiceId }: { backTo: string; invoiceId: string }) {
  const { t } = useApp();
  return (
    <InvoiceChrome backTo={backTo} invoiceId={invoiceId}>
      <div className="py-12 text-center text-sm text-muted-foreground">
        {t("Inapakia…", "Loading…")}
      </div>
    </InvoiceChrome>
  );
}

export function InvoicePrintScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/invoice/$id" });
  const { data: invoice, isPending } = useInvoice(id);
  const { data: customer } = useCustomer(invoice?.customerId ?? null);
  const { data: company } = useCompany();

  if (isPending || !invoice) return <InvoiceLoading backTo="/customers" invoiceId={id} />;

  const verifyUrl =
    typeof window !== "undefined" ? `${window.location.origin}/verify/${invoice.id}` : "";
  const backTo = invoice.kind === "order" ? "/pos" : "/customers";
  const billToSub = [customer?.phone, customer?.email].filter(Boolean) as string[];

  return (
    <InvoiceChrome backTo={backTo} invoiceId={invoice.id}>
      <InvoiceDocument
        company={company}
        billToName={customer?.name ?? invoice.customerName ?? t("Mteja", "Customer")}
        billToSub={billToSub}
        invoice={invoice}
        verifyUrl={verifyUrl}
      />
    </InvoiceChrome>
  );
}
