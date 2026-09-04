import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import {
  useFarmer,
  useFarmerPayouts,
  useUpdatePayout,
  useDeletePayout,
} from "@/lib/data/hooks/farmers";
import type { PayoutEntry } from "@/lib/data/farmers";
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
import { useState } from "react";
import { toast } from "sonner";
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
  const { t, can } = useApp();
  const canWrite = can("payout:write");
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
                  <th className="text-right">{t("Kiasi", "Amount")}</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{p.date}</td>
                    <td className="py-2.5 font-num text-xs">{p.ref ?? p.id}</td>
                    <td className="py-2.5 capitalize">{p.method}</td>
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(p.amountTZS)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {canWrite && <EditPayoutSheet payout={p} farmerName={farmer.name} />}
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

// Correcting a payment to a farmer. The old amount goes back on her
// balance before the new one comes off, and paying more than she is owed
// is still refused, measured against the balance once the old payment has
// been undone. Removing gives the money back in full.
function EditPayoutSheet({ payout, farmerName }: { payout: PayoutEntry; farmerName: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(payout.date);
  const [amount, setAmount] = useState<number>(payout.amountTZS);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">(
    (payout.method as "cash" | "mpesa" | "bank") ?? "cash",
  );
  const update = useUpdatePayout();
  const remove = useDeletePayout();

  const fail = (e: Error) =>
    toast.error(
      e.message.includes("amount-exceeds-balance")
        ? t("Kiasi ni kikubwa kuliko anachodai", "That is more than the farmer is owed")
        : t("Imeshindikana", "Could not save the change"),
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          {t("Hariri", "Edit")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Rekebisha malipo", "Correct this payment")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground font-num">
            {payout.ref ?? payout.id} · {farmerName}
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
            <Label>{t("Njia", "Method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("Taslimu", "Cash")}</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">{t("Benki", "Bank")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t(
              "Salio la mfugaji litarekebishwa kufuata kiasi kipya.",
              "The farmer's balance is adjusted to match the new amount.",
            )}
          </div>
        </div>
        <SheetFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <ConfirmDialog
            destructive
            title={t("Futa malipo haya?", "Remove this payment?")}
            description={t(
              "Fedha zitarudi kwenye salio la mfugaji na vitabu vitarekebishwa. Tumia hii kwa malipo yaliyorekodiwa mara mbili.",
              "The money goes back onto the farmer's balance and the books are corrected. Use this for a payment recorded twice.",
            )}
            confirmLabel={t("Futa", "Remove")}
            onConfirm={() =>
              remove.mutate(
                { id: payout.id, reason: "Removed from farmer payments" },
                {
                  onSuccess: () => {
                    toast.success(t("Yamefutwa", "Removed"));
                    setOpen(false);
                  },
                  onError: (e: Error) => fail(e),
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
            <Button
              disabled={amount <= 0 || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: payout.id, date, amountTZS: amount, method },
                  {
                    onSuccess: () => {
                      toast.success(t("Yamerekebishwa", "Corrected"));
                      setOpen(false);
                    },
                    onError: (e: Error) => fail(e),
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
