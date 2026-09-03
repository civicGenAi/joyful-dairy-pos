import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/app/context";
import { navGroupsFor } from "@/lib/nav";
import * as Icons from "lucide-react";
import { LayoutGrid, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A full-screen launcher: every screen the user's capabilities allow,
 * laid out as big tiles under its own category heading. Reaching a screen
 * becomes one glance and one click instead of scrolling the sidebar.
 * Nav comes from the same capability-driven source as the sidebar and the
 * command palette, so it can never drift out of sync with them.
 */
export function QuickJump() {
  const { t, lang, can } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const groups = navGroupsFor(can);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Freeze the page behind the overlay so a scroll gesture moves the
    // launcher's own list, not the dashboard underneath it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    nav({ to });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 text-left hover:bg-accent/40 transition"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <LayoutGrid className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{t("Nenda popote", "Jump to any screen")}</span>
          <span className="block text-xs text-muted-foreground">
            {t(
              "Fungua orodha kamili ya skrini zote kwa makundi",
              "Open the full list of screens, grouped by category",
            )}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm overflow-y-auto"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 12, scale: 0.99 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full bg-background p-4 sm:p-6 lg:p-8"
            >
              <div className="mx-auto max-w-6xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold font-display">
                      {t("Nenda popote", "Jump to any screen")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        "Bonyeza skrini yoyote kuifungua, au bonyeza Esc kufunga.",
                        "Click any screen to open it, or press Esc to close.",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"
                    aria-label={t("Funga", "Close")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-7">
                  {groups.map((group) => (
                    <div key={group.group}>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5">
                        {lang === "sw" ? group.sw : group.group}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {group.items.map((item) => {
                          const Icon =
                            (Icons[item.icon as keyof typeof Icons] as typeof LayoutGrid) ??
                            LayoutGrid;
                          return (
                            <button
                              key={item.to}
                              type="button"
                              onClick={() => go(item.to)}
                              className="rounded-xl border border-border bg-card p-4 text-left hover:border-[#1E7C3F] hover:bg-[#1E7C3F]/5 transition"
                            >
                              <span
                                className="grid h-9 w-9 place-items-center rounded-lg mb-2.5"
                                style={{ background: "#1E7C3F15", color: "#1E7C3F" }}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="block text-sm font-semibold leading-tight">
                                {lang === "sw" ? item.sw : item.label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground mt-0.5">
                                {lang === "sw" ? item.label : item.sw}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
