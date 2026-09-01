import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: additive to the existing day-lock reconciliation, never replaces
// it. src/lib/data/stockCounts + stock + packSizes. A morning ritual: count
// what's physically on the shelf/tank before the day's activity starts, so
// a mismatch is caught at 7am, not discovered at the evening lock.
import { useStock } from "@/lib/data/hooks/stock";
import { useStockCountsForDate, useRecordStockCount } from "@/lib/data/hooks/stockCounts";
import { usePackSizes } from "@/lib/data/hooks/packSizes";
import type { PackSize } from "@/lib/data/packSizes";
import { todayISO, dateLabel } from "@/lib/data/dates";
import { SectionCard, Pill } from "@/components/ui/data-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { num } from "@/lib/format";
import { ListChecks, Check, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import type { StockItem } from "@/mock/types";

const VARIANCE_TOLERANCE = 0.5;

export function StockCountScreen() {
  const { t, can } = useApp();
  const canWrite = can("stock:write");
  const today = todayISO();
  const { data: items = [], isPending: itemsPending } = useStock();
  const { data: counts = [], isPending: countsPending } = useStockCountsForDate(today);
  const { data: allSizes = [], isPending: sizesPending } = usePackSizes();

  const countable = items
    .filter((i) => i.active !== false && (i.category === "raw" || i.category === "finished"))
    .sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category === "raw" ? -1 : 1,
    );

  if (itemsPending || countsPending || sizesPending) {
    return (
      <AppShell title={t("Hesabu ya asubuhi", "Morning stock count")}>
        <SectionSkeleton>
          <TableSkeleton rows={6} cols={4} />
        </SectionSkeleton>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Hesabu ya asubuhi", "Morning stock count")}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t(
            "Hesabu kila kitu asubuhi kabla ya shughuli za siku kuanza, tofauti na mfumo zitaonekana papo hapo.",
            "Count everything each morning before the day's activity starts, any mismatch with the system shows up right away.",
          )}
        </div>
        <Pill tone="info">{dateLabel(today)}</Pill>
      </div>

      {countable.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t("Hakuna bidhaa za kuhesabu", "No items to count")}
          description={t(
            "Bidhaa za ghala zitaonekana hapa.",
            "Stock items will show up here once added.",
          )}
        />
      ) : (
        <div className="space-y-3">
          {countable.map((item) => (
            <CountRow
              key={item.id}
              item={item}
              date={today}
              sizes={allSizes.filter((p) => p.stockItemId === item.id)}
              existing={counts.find((c) => c.stockItemId === item.id)}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function CountRow({
  item,
  date,
  sizes,
  existing,
  canWrite,
}: {
  item: StockItem;
  date: string;
  sizes: PackSize[];
  existing?: { countedQty: number; variance: number; containers: Record<string, number> | null };
  canWrite: boolean;
}) {
  const { t } = useApp();
  const hasSizes = sizes.length > 0;
  const [containers, setContainers] = useState<Record<string, number>>(
    () => existing?.containers ?? {},
  );
  const [qty, setQty] = useState<number | "">(() => existing?.countedQty ?? "");
  const record = useRecordStockCount();
  const [savedVariance, setSavedVariance] = useState<number | null>(existing?.variance ?? null);

  useEffect(() => {
    if (hasSizes) {
      const total = sizes.reduce((a, p) => a + (containers[p.id] ?? 0) * p.qtyPerPack, 0);
      setQty(total);
    }
    // sizes is derived fresh from allSizes each render, comparing by content
    // via containers/hasSizes is enough, adding it would just re-run this
    // needlessly whenever the parent list re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, hasSizes]);

  const save = () => {
    const q = Number(qty);
    if (!q && q !== 0) return;
    record.mutate(
      { date, stockItemId: item.id, countedQty: q, containers: hasSizes ? containers : undefined },
      {
        onSuccess: (row) => {
          setSavedVariance(row.variance);
          toast.success(t("Hesabu imehifadhiwa", "Count saved"));
        },
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save the count")),
      },
    );
  };

  const balanced = savedVariance !== null && Math.abs(savedVariance) <= VARIANCE_TOLERANCE;

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <span>{item.name}</span>
          {item.swName && (
            <span className="text-xs font-normal text-muted-foreground">{item.swName}</span>
          )}
        </div>
      }
      action={
        <>
          <span className="text-xs text-muted-foreground">
            {t("Mfumo", "System")}:{" "}
            <span className="font-num font-semibold">{num(item.onHand)}</span> {item.unit}
          </span>
          {savedVariance !== null && (
            <Pill tone={balanced ? "success" : "danger"}>
              {balanced ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {balanced
                ? t("Sawa", "Balanced")
                : `${t("Tofauti", "Variance")} ${savedVariance > 0 ? "+" : ""}${num(savedVariance)}`}
            </Pill>
          )}
        </>
      }
    >
      {hasSizes ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sizes.map((p) => (
            <div key={p.id} className="grid gap-1">
              <label className="text-xs text-muted-foreground">
                {p.label} ({num(p.qtyPerPack)} {item.unit})
              </label>
              <Input
                type="number"
                step="any"
                min={0}
                disabled={!canWrite}
                value={containers[p.id] ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setContainers((cs) => ({ ...cs, [p.id]: Number(e.target.value) || 0 }))
                }
                className="font-num"
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
            <span className="text-sm">{t("Jumla", "Total")}</span>
            <span className="font-num font-bold">
              {num(Number(qty) || 0)} {item.unit}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div className="grid gap-1 flex-1 max-w-[160px]">
            <label className="text-xs text-muted-foreground">
              {t("Idadi iliyohesabiwa", "Counted quantity")} ({item.unit})
            </label>
            <Input
              type="number"
              step="any"
              min={0}
              disabled={!canWrite}
              value={qty}
              placeholder="0"
              onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
              className="font-num"
            />
          </div>
        </div>
      )}
      {canWrite && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={record.isPending} onClick={save}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi hesabu", "Save count")}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
