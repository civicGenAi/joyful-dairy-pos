import { useApp } from "@/app/context";
import { useAlerts } from "@/lib/data/hooks/reports";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

/**
 * A hard-to-miss reminder that yesterday hasn't been counted and locked
 * yet. Backed by the same "day-unbalanced" alert the bell already computes
 * (only fires when yesterday actually had activity and isn't locked), but
 * shown as a banner on the screens people actually start their day on
 * instead of only a notification badge that's easy to miss.
 */
export function DayLockBanner() {
  const { t, can } = useApp();
  const { data: alerts = [] } = useAlerts();
  const unlocked = alerts.find((a) => a.kind === "day-unbalanced");
  if (!unlocked) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5A100]/30 bg-[#E5A100]/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-[#8a5a00]" />
      <div className="flex-1 min-w-0 text-[#8a5a00]">
        <span className="font-semibold">
          {t("Jana bado haijafungwa.", "Yesterday isn't locked yet.")}
        </span>{" "}
        {t(
          "Hesabu ya kimwili ya jana bado haijalinganishwa na kufungwa, fanya hivyo kabla ya kuanza mauzo ya leo.",
          "Yesterday's physical count still hasn't been reconciled and locked, do that before starting today's sales.",
        )}
      </div>
      {can("day:lock") && (
        <Link
          to="/reconciliation"
          className="shrink-0 rounded-lg bg-[#8a5a00] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#734b00]"
        >
          {t("Nenda Uwiano", "Go to Reconciliation")}
        </Link>
      )}
    </div>
  );
}
