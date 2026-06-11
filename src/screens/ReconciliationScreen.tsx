import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/recon + collections; the
// conservation check is authoritative server-side in the lock_day RPC.
import { useReconForDate, useDayLock, useDayLocks, useLockDay } from "@/lib/data/hooks/recon";
import { useCollections } from "@/lib/data/hooks/collections";
import { todayISO, dateLabel } from "@/lib/data/dates";
import type { ReconRow } from "@/lib/data/recon";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { num } from "@/lib/format";
import { Check, X, Lock, Sigma, FileText, History, ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Link } from "@tanstack/react-router";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";

export function ReconciliationScreen() {
  const { t, can } = useApp();
  const canLock = can("day:lock");
  const today = todayISO();
  const { data: liveRows = [], isPending, isError, refetch } = useReconForDate(today);
  const { data: lock } = useDayLock(today);
  const { data: pastLocks = [] } = useDayLocks();
  const { data: collections = [] } = useCollections(today);
  const lockDay = useLockDay();
  // Physical closing counts entered by production/admin; default = ledger value.
  const [physical, setPhysical] = useState<Record<string, number>>({});

  const locked = !!lock;
  const rows: ReconRow[] = locked ? lock.rows : liveRows;

  const closingOf = (r: ReconRow) => (locked ? r.closing : (physical[r.productId] ?? r.closing));
  const deltaOf = (r: ReconRow) => r.closing - closingOf(r);
  const isBalanced = (r: ReconRow) => Math.abs(deltaOf(r)) <= 0.05;
  const allBalanced = rows.every(isBalanced);

  // Raw milk sources derived from today's collections + carried-over opening.
  const sources = useMemo(() => {
    const byPoint: Record<string, number> = { "field-a": 0, main: 0 };
    for (const c of collections) byPoint[c.point] = (byPoint[c.point] ?? 0) + c.litres;
    const opening = rows.reduce((a, r) => a + (r.unit === "L" ? r.opening : 0), 0);
    return [
      { src: t("Pointi A, Olasiti", "Point A, Olasiti"), l: byPoint["field-a"] ?? 0 },
      { src: t("Wafugaji wa kiwandani, Main", "Plant farmers, Main"), l: byPoint["main"] ?? 0 },
      { src: t("Baridi (jana)", "Cold-room (yesterday)"), l: opening },
    ];
  }, [t, collections, rows]);

  const sourcesTotal = sources.reduce((a, s) => a + s.l, 0);
  const farmerCount = new Set(collections.map((c) => c.farmerId)).size;

  const doLock = () => {
    lockDay.mutate(
      {
        date: today,
        physical: rows.map((r) => ({ productId: r.productId, closing: closingOf(r) })),
      },
      {
        onSuccess: () => toast.success(t("Siku imefungwa", "Day locked")),
        onError: (e) =>
          toast.error(
            e.message.includes("day-unbalanced")
              ? t("Siku haijasawazishwa", "Day is not balanced")
              : e.message.includes("already-locked")
                ? t("Siku tayari imefungwa", "Day already locked")
                : e.message.includes("42501") || e.message.includes("forbidden")
                  ? t("Huna ruhusa", "Not permitted")
                  : t("Imeshindikana kufunga siku", "Could not lock the day"),
          ),
      },
    );
  };

  if (isPending) {
    return (
      <AppShell title={t("Sawazisha siku, Funga siku", "Day reconciliation & day-close")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={10} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title={t("Sawazisha siku, Funga siku", "Day reconciliation & day-close")}>
        <EmptyState
          icon={ClipboardCheck}
          title={t("Imeshindikana kupakia sawazisho", "Could not load reconciliation")}
          description={t("Tafadhali jaribu tena.", "Please try again.")}
          action={
            <Button onClick={() => refetch()} variant="outline">
              {t("Jaribu tena", "Retry")}
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Sawazisha siku, Funga siku", "Day reconciliation & day-close")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Bidhaa", "Products")} value={rows.length} accent="green" />
        <StatCard
          label={t("Zilizosawazi", "Balanced")}
          value={`${rows.filter(isBalanced).length}/${rows.length}`}
          accent={allBalanced ? "green" : "amber"}
        />
        <StatCard
          label={t("Hali ya siku", "Day status")}
          value={locked ? t("Imefungwa", "Locked") : t("Imefunguliwa", "Open")}
          accent={locked ? "green" : "amber"}
        />
        <StatCard label={t("Tarehe", "Date")} value={dateLabel(today)} accent="info" />
      </div>

      <div className="rounded-2xl border border-[#1E7C3F]/30 bg-[#1E7C3F]/5 p-4 mb-5 flex items-center gap-3">
        <Sigma className="h-5 w-5 text-[#1E7C3F]" />
        <div className="flex-1">
          <div className="font-semibold text-sm">
            {t("Kanuni ya usawazishaji", "Conservation rule")}
          </div>
          <div className="text-xs font-num text-[#14532D]">
            Opening + Collected + Produced = Sold cash + Sold credit + Separated + Spoilt + Returned
            + Closing
          </div>
        </div>
        <Pill tone={allBalanced ? "success" : "danger"}>
          {allBalanced ? t("Sawa", "OK") : t("Hata", "Mismatch")}
        </Pill>
      </div>

      {locked && (
        <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/10 p-4 mb-5 flex items-center gap-3">
          <Lock className="h-5 w-5 text-[#0f5d44]" />
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {t("Siku imefungwa, kusoma tu", "Day locked, read-only")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Imefungwa na", "Locked by")} {lock.lockedByName ?? "·"} ·{" "}
              {new Date(lock.lockedAt).toLocaleTimeString()}
              {lock.confirmedAt && (
                <>
                  {" "}
                  · {t("Imethibitishwa na", "Confirmed by")} {lock.confirmedByName ?? "Finance"}
                </>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="border-[#1E7C3F] text-[#1E7C3F]">
            <Link to="/report/day-close/$date" params={{ date: today }}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t("Ripoti ya kufunga", "Open report")}
            </Link>
          </Button>
        </div>
      )}

      <SectionCard
        title={t("Sawazisho la kila bidhaa", "Per-product reconciliation")}
        action={
          <div className="flex gap-2">
            <ExportMenu formats={["pdf"]} filename={`day-reconciliation-${today}`} />
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link to="/report/day-close/$date" params={{ date: today }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {t("Tazama ripoti", "Preview report")}
              </Link>
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={t("Hakuna harakati za leo bado", "No movements recorded today yet")}
            description={t(
              "Rekodi ukusanyaji, uzalishaji au mauzo kwanza.",
              "Record collections, production or sales first.",
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Bidhaa", "Product")}</th>
                  <th className="text-right px-2">{t("Awali", "Opening")}</th>
                  <th className="text-right px-2">{t("Kusanywa", "Collected")}</th>
                  <th className="text-right px-2">{t("Tengeneza", "Produced")}</th>
                  <th className="text-right px-2">{t("Cash", "Cash")}</th>
                  <th className="text-right px-2">{t("Mkopo", "Credit")}</th>
                  <th className="text-right px-2">{t("Tenga", "Separated")}</th>
                  <th className="text-right px-2">{t("Haribika", "Spoilt")}</th>
                  <th className="text-right px-2">{t("Rudi", "Returned")}</th>
                  <th className="text-right px-2">{t("Bakia", "Closing")}</th>
                  <th className="text-center px-2">{t("Sawazi", "Balanced")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = isBalanced(r);
                  const editable = !locked && canLock;
                  const show = (value: number) => (
                    <span className="font-num">{num(value, value % 1 ? 2 : 0)}</span>
                  );
                  return (
                    <tr
                      key={r.productId}
                      className={`border-b border-border last:border-0 hover:bg-accent/40 ${!ok ? "bg-[#E11B22]/5" : ""}`}
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.product}{" "}
                        <span className="text-xs text-muted-foreground">({r.unit})</span>
                      </td>
                      <td className="py-1 px-2 text-right">{show(r.opening)}</td>
                      <td className="py-1 px-2 text-right">{show(r.collected)}</td>
                      <td className="py-1 px-2 text-right">{show(r.produced)}</td>
                      <td className="py-1 px-2 text-right">{show(r.soldCash)}</td>
                      <td className="py-1 px-2 text-right">{show(r.soldCredit)}</td>
                      <td className="py-1 px-2 text-right">{show(r.separated)}</td>
                      <td className="py-1 px-2 text-right text-[#E11B22]">{show(r.spoilt)}</td>
                      <td className="py-1 px-2 text-right">{show(r.returned)}</td>
                      <td className="py-1 px-2 text-right font-bold">
                        {editable ? (
                          <Input
                            type="number"
                            value={closingOf(r)}
                            step={r.closing % 1 ? 0.05 : 1}
                            onChange={(e) =>
                              setPhysical((p) => ({
                                ...p,
                                [r.productId]: Number(e.target.value),
                              }))
                            }
                            className="h-7 w-20 ml-auto text-right font-num text-xs"
                          />
                        ) : (
                          show(closingOf(r))
                        )}
                      </td>
                      <td
                        className="py-2.5 px-2 text-center"
                        title={ok ? "" : `Δ ${num(deltaOf(r), 2)}`}
                      >
                        {ok ? (
                          <Check className="inline h-4 w-4 text-[#2F9E44]" />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#E11B22] text-[11px] font-num font-semibold">
                            <X className="h-3.5 w-3.5" />Δ {num(deltaOf(r), 2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!allBalanced && (
          <div className="mt-3 rounded-xl bg-[#E11B22]/5 border border-[#E11B22]/30 p-3 text-xs text-[#8c0d12]">
            {t(
              "Mistari iliyo nyekundu haijasawazi: hesabu halisi inatofautiana na daftari. Hakiki hesabu au rekodi uharibifu au marekebisho yanayokosekana.",
              "Red rows do not balance: the physical count differs from the ledger. Re-check the count or record the missing spoilage or adjustment.",
            )}
          </div>
        )}
      </SectionCard>

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <SectionCard title={t("Vyanzo vya maziwa ghafi leo", "Raw milk sources today")}>
          <ul className="divide-y divide-border">
            {sources.map((s) => (
              <li key={s.src} className="flex justify-between py-2.5">
                <span className="font-medium">{s.src}</span>
                <span className="font-num font-semibold">{num(s.l)} L</span>
              </li>
            ))}
            <li className="flex justify-between py-3 font-bold border-t-2 border-[#1E7C3F]/40">
              <span>{t("Jumla", "Total")}</span>
              <span className="font-num text-[#1E7C3F]">{num(sourcesTotal)} L</span>
            </li>
          </ul>
          <div className="mt-3 text-xs text-muted-foreground">
            {t("Imejumlishwa kutoka kwa wafugaji", "Aggregated from")} {farmerCount}{" "}
            {t("wakichukua mizigo miwili kwa siku.", "farmers across two daily sessions.")}
          </div>
        </SectionCard>

        <SectionCard title={t("Funga siku", "Day close")}>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "Baada ya kufunga, salio la mwisho linakuwa salio la awali la kesho. Inahitajika jukumu la Production au Admin.",
              "After locking, closing balances become tomorrow's opening. Requires Production Manager or Admin role.",
            )}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {rows.slice(0, 3).map((r) => (
              <div key={r.productId} className="rounded-xl bg-secondary/60 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {r.product}
                </div>
                <div className="font-num font-bold">
                  {num(closingOf(r), closingOf(r) % 1 ? 2 : 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t("Salio la awali la kesho", "Tomorrow's opening")}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <ConfirmDialog
              title={t("Funga siku?", "Lock the day?")}
              description={t(
                "Mara baada ya kufunga, takwimu za siku haziwezi kubadilishwa. Salio la mwisho litakuwa la awali la kesho.",
                "Once locked, today's figures become read-only and tomorrow opens from these closing balances.",
              )}
              confirmLabel={t("Funga siku", "Lock day")}
              onConfirm={() => {
                if (!allBalanced) {
                  toast.error(
                    t("Bidhaa moja au zaidi haijasawazi.", "One or more products are unbalanced."),
                  );
                  return;
                }
                doLock();
              }}
              trigger={
                <Button
                  disabled={
                    !canLock || locked || !allBalanced || lockDay.isPending || rows.length === 0
                  }
                  className="text-white"
                  style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                >
                  <Lock className="h-4 w-4 mr-1.5" />
                  {locked
                    ? t("Imefungwa", "Locked")
                    : lockDay.isPending
                      ? t("Inafunga…", "Locking…")
                      : t("Funga siku", "Lock day")}
                </Button>
              }
            />
            {!canLock && <Pill tone="warning">{t("Huna ruhusa", "No permission")}</Pill>}
            {!allBalanced && canLock && !locked && (
              <Pill tone="danger">{t("Sawazisha kwanza", "Resolve mismatches")}</Pill>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard
          title={t("Historia ya kufunga siku", "Past day-closes")}
          action={<History className="h-4 w-4 text-muted-foreground" />}
        >
          {pastLocks.length === 0 ? (
            <EmptyState
              icon={History}
              title={t("Hakuna siku zilizofungwa bado", "No locked days yet")}
            />
          ) : (
            <ul className="divide-y divide-border">
              {pastLocks.map((p) => (
                <li key={p.date} className="flex items-center gap-3 py-3">
                  <Lock className="h-4 w-4 text-[#1E7C3F]" />
                  <div className="flex-1">
                    <div className="font-medium">{p.date}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("Imefungwa na", "Locked by")} {p.lockedByName ?? "·"}
                    </div>
                  </div>
                  <Pill tone={p.confirmedAt ? "success" : "warning"}>
                    {p.confirmedAt
                      ? t("Imethibitishwa", "Confirmed")
                      : t("Inasubiri Finance", "Awaiting finance")}
                  </Pill>
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                    <Link to="/report/day-close/$date" params={{ date: p.date }}>
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      {t("Ripoti", "Report")}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
