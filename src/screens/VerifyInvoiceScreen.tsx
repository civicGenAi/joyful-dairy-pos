import { JoyLogo } from "@/components/brand/JoyLogo";
import { useApp } from "@/app/context";
import { useVerifyInvoice } from "@/lib/data/hooks/invoices";
import { useParams } from "@tanstack/react-router";
import { tzs } from "@/lib/format";
import { dateLabel } from "@/lib/data/dates";
import { ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react";

// Public, no login: this is what a customer's phone opens when they scan
// the QR code on a printed invoice. Deliberately shows only enough to
// confirm the invoice is genuine, issuer, number, dates, amount, nothing
// that would matter if the invoice itself was lost or shared. Backed by
// verify_invoice(), the one RPC in this app anon can call.

export function VerifyInvoiceScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/verify/$id" });
  const { data, isPending, isError } = useVerifyInvoice(id);

  const notFound = !isPending && (!data?.found || isError);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-sm w-full text-center">
        <div className="flex justify-center mb-6">
          <JoyLogo />
        </div>

        {isPending && (
          <div className="text-sm text-muted-foreground py-10">
            {t("Inathibitisha…", "Verifying…")}
          </div>
        )}

        {!isPending && notFound && (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#E5A100]/15 text-[#8a5a00] mb-5">
              <ShieldX className="h-9 w-9" />
            </div>
            <h1 className="font-display text-xl font-bold">
              {t("Ankara haikuthibitishwa", "Invoice not verified")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {t(
                "Hatukupata ankara yenye namba hii kwenye mfumo wetu.",
                "We couldn't find an invoice with this number in our system.",
              )}
            </p>
          </>
        )}

        {!isPending && data?.found && (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#DFF0E4] text-[#2C7A4B] mb-5 shadow-elevated">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <h1 className="font-display text-xl font-bold text-[#2C7A4B]">
              {t("Ankara halisi", "Genuine invoice")}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {t(
                `Imetolewa na ${data.issuer}${data.issuerCity ? `, ${data.issuerCity}` : ""}`,
                `Issued by ${data.issuer}${data.issuerCity ? `, ${data.issuerCity}` : ""}`,
              )}
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("Ankara", "Invoice")}</span>
                <span className="font-num font-semibold">{data.invoiceId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("Tarehe", "Issued")}</span>
                <span className="font-num">{dateLabel((data.issuedAt ?? "").slice(0, 10))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("Mwisho wa malipo", "Due date")}</span>
                <span className="font-num">{dateLabel(data.dueDate ?? "")}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2.5 mt-1">
                <span className="font-semibold">{t("Kiasi", "Amount")}</span>
                <span className="font-num font-bold text-base">{tzs(data.amountTZS ?? 0)}</span>
              </div>
            </div>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldQuestion className="h-3.5 w-3.5" />
          {t(
            "Ukurasa huu unathibitisha uhalisi tu, siyo maelezo kamili ya ankara.",
            "This page confirms authenticity only, not the full invoice detail.",
          )}
        </div>
      </div>
    </div>
  );
}
