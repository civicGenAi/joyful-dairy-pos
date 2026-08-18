import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: additive to the existing day-lock reconciliation, never replaces
// it. src/lib/data/stockCounts + stock. A morning ritual: count what's
// physically on the shelf/tank before the day's activity starts, so a
// mismatch is caught at 7am, not discovered at the evening lock.
import { useStock } from "@/lib/data/hooks/stock";
import { useStockCountsForDate, useRecordStockCount } from "@/lib/data/hooks/stockCounts";
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

// Raw milk is the only item counted by container, everything else (finished
// products) is one plain number in its own unit, per how the business
// actually counts stock: cheese and yoghurt don't come in a mix of jerrican
// sizes, only milk does.
const MILK_CONTAINERS: { id: string; litres: number; label: { sw: string; en: string } }[] = [
  { id: "ndoo20", litres: 20, label: { sw: "Ndoo (20L)", en: "20L bucket (ndoo)" } },
  { id: "galoni5", litres: 5, label: { sw: "Galoni 5L", en: "5L jerrican" } },
  { id: "galoni3", litres: 3, label: { sw: "Galoni 3L", en: "3L jerrican" } },
  { id: "chupa1_5", litres: 1.5, label: { sw: "Chupa 1.5L", en: "1.5L bottle" } },
];

const VARIANCE_TOLERANCE = 0.5;

export function StockCountScreen() {
  const { t, can } = useApp();
  const canWrite = can("stock:write");
  const today = todayISO();
  const { data: items = [], isPending: itemsPending } = useStock();
  const { data: counts = [], isPending: countsPending } = useStockCountsForDate(today);

  const countable = items
    .filter((i) => i.active !== false && (i.category === "raw" || i.category === "finished"))
    .sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category === "raw" ? -1 : 1,
    );

  if (itemsPending || countsPending) {
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
  existing,
  canWrite,
}: {
  item: StockItem;
  date: string;
  existing?: { countedQty: number; variance: number; containers: Record<string, number> | null };
  canWrite: boolean;
}) {
  const { t, lang } = useApp();
  const isMilk = item.category === "raw";
  const [containers, setContainers] = useState<Record<string, number>>(
    () => existing?.containers ?? {},
  );
  const [qty, setQty] = useState<number | "">(() => existing?.countedQty ?? "");
  const record = useRecordStockCount();
  const [savedVariance, setSavedVariance] = useState<number | null>(existing?.variance ?? null);

  useEffect(() => {
    if (isMilk) {
      const total = MILK_CONTAINERS.reduce((a, c) => a + (containers[c.id] ?? 0) * c.litres, 0);
      setQty(total);
    }
  }, [containers, isMilk]);

  const save = () => {
    const q = Number(qty);
    if (!q && q !== 0) return;
    record.mutate(
      { date, stockItemId: item.id, countedQty: q, containers: isMilk ? containers : undefined },
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
      {isMilk ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MILK_CONTAINERS.map((c) => (
            <div key={c.id} className="grid gap-1">
              <label className="text-xs text-muted-foreground">{c.label[lang]}</label>
              <Input
                type="number"
                min={0}
                disabled={!canWrite}
                value={containers[c.id] ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setContainers((cs) => ({ ...cs, [c.id]: Number(e.target.value) || 0 }))
                }
                className="font-num"
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
            <span className="text-sm">{t("Jumla ya lita", "Total litres")}</span>
            <span className="font-num font-bold">{num(Number(qty) || 0)} L</span>
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
