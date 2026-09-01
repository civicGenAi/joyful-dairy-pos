import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { useFarmer, useFarmerPayouts } from "@/lib/data/hooks/farmers";
import { useParams, Link } from "@tanstack/react-router";
import { SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { tzs, num } from "@/lib/format";
import { ArrowLeft, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { usePagination } from "@/hooks/use-pagination";

// A dedicated view of one farmer's full payout history, reached by clicking
// their "Last payment" cell in the Farmers list, instead of only ever
// seeing the last 12 payouts tucked inside the farmer detail drawer.
export function FarmerPaymentsScreen() {
  const { t } = useApp();
  const { id } = useParams({ from: "/payments/farmer/$id" });
  const { data: farmer, isPending: farmerPending } = useFarmer(id);
  const { data: payouts = [], isPending: payoutsPending } = useFarmerPayouts(id, 500);
  const { page, setPage, totalPages, paged, pageSize, total, start } = usePagination(payouts, 20);

  if (farmerPending || payoutsPending) {
    return (
      <AppShell title={t("Malipo ya mfugaji", "Farmer payments")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={4} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (!farmer) {
    return (
      <AppShell title={t("Malipo ya mfugaji", "Farmer payments")}>
        <EmptyState title={t("Mfugaji hajapatikana", "Farmer not found")} />
      </AppShell>
    );
  }

  const totalPaid = payouts.reduce((a, p) => a + p.amountTZS, 0);

  return (
    <AppShell title={t(`Malipo, ${farmer.name}`, `Payments, ${farmer.name}`)}>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/farmers">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t("Rudi kwa wafugaji", "Back to farmers")}
        </Link>
      </Button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Amelipwa jumla", "Total paid all-time")}
          value={tzs(totalPaid)}
          accent="green"
        />
        <StatCard
          label={t("Idadi ya malipo", "Number of payouts")}
          value={num(payouts.length)}
          accent="info"
        />
        <StatCard
          label={t("Deni la sasa", "Current balance")}
          value={tzs(farmer.currentBalanceTZS)}
          accent="amber"
        />
        <StatCard label={t("Bei", "Rate")} value={`${num(farmer.ratePerL)}/L`} accent="green" />
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {t("Historia kamili ya malipo", "Full payment history")}
          </span>
        }
      >
        {payouts.length === 0 ? (
          <EmptyState title={t("Hakuna malipo bado", "No payouts yet")} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Tarehe", "Date")}</th>
                  <th>{t("Rejea", "Reference")}</th>
                  <th>{t("Njia", "Method")}</th>
                  <th className="text-right px-3">{t("Kiasi", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{p.date}</td>
                    <td className="py-2.5 font-num text-xs">{p.ref ?? "·"}</td>
                    <td className="py-2.5 capitalize">{p.method}</td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold">
                      {tzs(p.amountTZS)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              start={start}
              onPageChange={setPage}
            />
          </>
        )}
      </SectionCard>
    </AppShell>
  );
}
