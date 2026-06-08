import { Link, useRouterState } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useApp } from "@/app/context";
import { NAV_GROUPS_BY_ROLE } from "@/mock/data";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: Props) {
  const { role, lang, t } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = NAV_GROUPS_BY_ROLE[role] ?? [];

  const width = collapsed ? "w-[72px]" : "w-[252px]";

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200",
          width,
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          groups={groups}
          lang={lang}
          pathname={pathname}
          t={t}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>

      {/* Mobile off-canvas drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r border-border bg-sidebar lg:hidden"
          >
            <SidebarBody
              collapsed={false}
              groups={groups}
              lang={lang}
              pathname={pathname}
              t={t}
              onNavigate={onCloseMobile}
              extraTopRight={
                <button
                  onClick={onCloseMobile}
                  className="rounded-lg p-1.5 hover:bg-accent"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarBody({
  collapsed,
  groups,
  lang,
  pathname,
  t,
  onToggleCollapsed,
  onNavigate,
  extraTopRight,
}: {
  collapsed: boolean;
  groups: { group: string; sw: string; items: { to: string; label: string; sw: string; icon: string }[] }[];
  lang: "sw" | "en";
  pathname: string;
  t: (sw: string, en: string) => string;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  extraTopRight?: React.ReactNode;
}) {
  return (
    <>
      <div className={cn("px-3 py-4 border-b border-border flex items-center justify-between gap-2", collapsed && "px-2 justify-center")}>
        <JoyLogo size={collapsed ? 32 : 36} showWordmark={!collapsed} />
        {extraTopRight}
        {onToggleCollapsed && !collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="rounded-lg p-1.5 hover:bg-accent"
            aria-label="Collapse sidebar"
            title={t("Funga upau", "Collapse")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {onToggleCollapsed && collapsed && (
        <button
          onClick={onToggleCollapsed}
          className="mt-2 mx-auto rounded-lg p-1.5 hover:bg-accent"
          aria-label="Expand sidebar"
          title={t("Fungua upau", "Expand")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <nav className={cn("flex-1 overflow-y-auto py-4 space-y-5", collapsed ? "px-2" : "px-3")}>
        {groups.map((g) => (
          <div key={g.group}>
            {!collapsed && (
              <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {lang === "sw" ? g.sw : g.group}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon =
                  (Icons as unknown as Record<string, typeof Icons.Circle>)[it.icon] ??
                  Icons.Circle;
                const active =
                  pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      onClick={onNavigate}
                      title={collapsed ? (lang === "sw" ? it.sw : it.label) : undefined}
                      className={cn(
                        "relative flex items-center rounded-xl text-sm font-medium transition-all",
                        collapsed
                          ? "h-10 w-10 mx-auto justify-center"
                          : "gap-2.5 px-2.5 py-2",
                        active
                          ? "text-white shadow-card"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground",
                      )}
                      style={
                        active
                          ? { background: "linear-gradient(135deg, #1E7C3F 0%, #2F9E44 55%, #8CC63F 120%)" }
                          : undefined
                      }
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 -z-0 rounded-xl"
                          style={{ background: "linear-gradient(135deg, #1E7C3F 0%, #2F9E44 55%, #8CC63F 120%)" }}
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon className={cn("h-4 w-4 relative z-10", active && "text-white")} />
                      {!collapsed && (
                        <span className="relative z-10 truncate">
                          {lang === "sw" ? it.sw : it.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div
          className="m-3 rounded-xl p-3 text-xs text-white"
          style={{ background: "linear-gradient(135deg, #14532D, #1E7C3F)" }}
        >
          <div className="font-semibold mb-0.5">{lang === "sw" ? "Funga siku" : "Day status"}</div>
          <div className="opacity-90">
            {lang === "sw" ? "Siku iko wazi, bado haijafungwa" : "Day open, not yet locked"}
          </div>
        </div>
      )}
    </>
  );
}
