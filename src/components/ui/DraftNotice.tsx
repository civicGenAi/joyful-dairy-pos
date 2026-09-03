import { useApp } from "@/app/context";

/**
 * Shown at the top of a form whose previous, unsaved entry was restored,
 * so a half-filled form is never a mystery: it says where the values came
 * from and offers a one-click way to start over.
 */
export function DraftNotice({ show, onDiscard }: { show: boolean; onDiscard: () => void }) {
  const { t } = useApp();
  if (!show) return null;
  return (
    <div className="rounded-xl border border-[#E5A100]/40 bg-[#E5A100]/10 px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-[11px] text-[#8a5a00]">
        {t(
          "Tumerudisha ulichokuwa umeandika mara ya mwisho.",
          "We brought back what you had typed last time.",
        )}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="text-[11px] font-semibold underline underline-offset-2 shrink-0"
      >
        {t("Anza upya", "Start fresh")}
      </button>
    </div>
  );
}
