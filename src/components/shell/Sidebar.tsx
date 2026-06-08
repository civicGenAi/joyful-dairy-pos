import { Link, useRouterState } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useApp } from "@/app/context";
import { NAV_GROUPS_BY_ROLE } from "@/mock/data";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function Sidebar() {
  const { role, lang } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = NAV_GROUPS_BY_ROLE[role] ?? [];

  return (
    <aside className="hidden lg:flex w-[252px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5 border-b border-border">
        <JoyLogo />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {lang === "sw" ? g.sw : g.group}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = (Icons as any)[it.icon] ?? Icons.Circle;
                const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all",
                        active
                          ? "text-white shadow-card"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground"
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
                      <Icon className={cn("h-4 w-4 relative z-10", active ? "text-white" : "")} />
                      <span className="relative z-10">{lang === "sw" ? it.sw : it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl p-3 text-xs text-white" style={{ background: "linear-gradient(135deg, #14532D, #1E7C3F)" }}>
        <div className="font-semibold mb-0.5">{lang === "sw" ? "Funga siku" : "Day status"}</div>
        <div className="opacity-90">{lang === "sw" ? "Siku iko wazi, bado haijafungwa" : "Day open, not yet locked"}</div>
      </div>
    </aside>
  );
}
