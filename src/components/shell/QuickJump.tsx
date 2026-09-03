import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/app/context";
import { navGroupsFor } from "@/lib/nav";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 660;
const GAP = 8;
const EDGE = 12;

/**
 * Shortcut: a flyout listing every screen the user's capabilities allow,
 * grouped by category in columns, in the shape a product switcher usually
 * takes (anchored beside its trigger, sized to its content, closed by an
 * outside click or Esc) rather than a full-screen takeover.
 *
 * The trigger sits in the sidebar's Overview group under Dashboard. Nav
 * comes from the same capability-driven source the sidebar and command
 * palette read, so the three can never drift apart.
 */
export function QuickJump({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t, lang, can } = useApp();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const groups = navGroupsFor(can);

  // Anchored to the trigger, then pulled back inside the viewport. Fixed
  // rather than absolute: the sidebar's nav scrolls and would clip it.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2);
    const height = panelRef.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(rect.right + GAP, EDGE),
      Math.max(window.innerWidth - width - EDGE, EDGE),
    );
    const top = Math.min(
      Math.max(rect.top, EDGE),
      Math.max(window.innerHeight - height - EDGE, EDGE),
    );
    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const go = (to: string) => {
    setOpen(false);
    onNavigate?.();
    nav({ to });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? t("Shortcut", "Shortcut") : undefined}
        className={cn(
          "w-full flex items-center rounded-xl text-sm font-medium transition-all",
          open
            ? "bg-accent text-foreground"
            : "text-foreground/80 hover:bg-accent hover:text-foreground",
          collapsed ? "h-10 w-10 mx-auto justify-center" : "gap-2.5 px-2.5 py-2",
        )}
      >
        {collapsed ? (
          <span className="text-base font-bold leading-none">⋯</span>
        ) : (
          <span className="truncate">{t("Shortcut", "Shortcut")}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-catcher only, the page stays visible behind it. */}
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.13 }}
              style={{
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                width: `min(${PANEL_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
              }}
              className="fixed z-[61] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-elevated p-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
                {groups.map((group) => (
                  <div key={group.group}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5 px-2">
                      {lang === "sw" ? group.sw : group.group}
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => (
                        <li key={item.to}>
                          <button
                            type="button"
                            onClick={() => go(item.to)}
                            className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition"
                          >
                            {lang === "sw" ? item.sw : item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
