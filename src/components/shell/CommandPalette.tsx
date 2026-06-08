import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/app/context";
import { CUSTOMERS, FARMERS, PRODUCTS, NAV_GROUPS_BY_ROLE } from "@/mock/data";
import * as Icons from "lucide-react";
import {
  Search,
  Sun,
  Moon,
  Languages,
  LogOut,
  ArrowRight,
  User as UserIcon,
  Tractor,
  Package,
  FileText,
} from "lucide-react";

/**
 * Global command palette opened with Cmd/Ctrl + K. Searches across navigation,
 * customers, farmers, products and surfaces a handful of quick actions.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { t, role, lang, setLang, setTheme, theme, logout, user } = useApp();
  const groups = NAV_GROUPS_BY_ROLE[role] ?? [];

  // Global Cmd/Ctrl+K listener. Skip when typing in an editable element so
  // we don't hijack regular form K-presses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.getAttribute("contenteditable") === "true";
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      } else if (!inField && e.key === "/" && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    nav({ to });
  };

  if (!user) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-start sm:place-items-center pt-20 sm:pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-elevated overflow-hidden"
          >
            <Command label="Global command menu" className="flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Command.Input
                  value={q}
                  onValueChange={setQ}
                  placeholder={t(
                    "Tafuta moduli, wateja, wafugaji, bidhaa…",
                    "Search modules, customers, farmers, products…",
                  )}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-sm text-center text-muted-foreground">
                  {t("Hakuna matokeo", "No results")}
                </Command.Empty>

                {/* Quick actions */}
                <Command.Group heading={t("Vitendo", "Quick actions")} className="cmdk-group">
                  <CmdItem
                    icon={Sun}
                    label={t("Mwonekano wa mwanga", "Light theme")}
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                    rightHint={theme === "light" ? "✓" : undefined}
                  />
                  <CmdItem
                    icon={Moon}
                    label={t("Mwonekano wa giza", "Dark theme")}
                    onSelect={() => {
                      setTheme("dark");
                      setOpen(false);
                    }}
                    rightHint={theme === "dark" ? "✓" : undefined}
                  />
                  <CmdItem
                    icon={Languages}
                    label={
                      lang === "sw"
                        ? t("Badilisha kuwa English", "Switch to English")
                        : t("Badilisha kuwa Kiswahili", "Switch to Kiswahili")
                    }
                    onSelect={() => {
                      setLang(lang === "sw" ? "en" : "sw");
                      setOpen(false);
                    }}
                  />
                  <CmdItem
                    icon={LogOut}
                    label={t("Toka", "Sign out")}
                    onSelect={() => {
                      setOpen(false);
                      logout();
                      nav({ to: "/" });
                    }}
                    tone="danger"
                  />
                </Command.Group>

                {/* Navigation */}
                <Command.Group heading={t("Nenda kwenye", "Go to")} className="cmdk-group">
                  {groups.flatMap((g) =>
                    g.items.map((it) => {
                      const Icon =
                        (Icons as unknown as Record<string, typeof Icons.Circle>)[it.icon] ??
                        ArrowRight;
                      const label = lang === "sw" ? it.sw : it.label;
                      return (
                        <CmdItem
                          key={it.to}
                          icon={Icon}
                          label={label}
                          rightHint={lang === "sw" ? g.sw : g.group}
                          onSelect={() => go(it.to)}
                        />
                      );
                    }),
                  )}
                </Command.Group>

                {/* Customers */}
                {q && (
                  <Command.Group heading={t("Wateja", "Customers")} className="cmdk-group">
                    {CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
                      .slice(0, 6)
                      .map((c) => (
                        <CmdItem
                          key={c.id}
                          icon={UserIcon}
                          label={c.name}
                          rightHint={c.type}
                          onSelect={() => go("/customers")}
                        />
                      ))}
                  </Command.Group>
                )}

                {/* Farmers */}
                {q && (
                  <Command.Group heading={t("Wafugaji", "Farmers")} className="cmdk-group">
                    {FARMERS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
                      .slice(0, 6)
                      .map((f) => (
                        <CmdItem
                          key={f.id}
                          icon={Tractor}
                          label={f.name}
                          rightHint={f.village}
                          onSelect={() => go("/farmers")}
                        />
                      ))}
                  </Command.Group>
                )}

                {/* Products */}
                {q && (
                  <Command.Group heading={t("Bidhaa", "Products")} className="cmdk-group">
                    {PRODUCTS.filter(
                      (p) =>
                        p.name.toLowerCase().includes(q.toLowerCase()) ||
                        p.swName.toLowerCase().includes(q.toLowerCase()),
                    )
                      .slice(0, 6)
                      .map((p) => (
                        <CmdItem
                          key={p.id}
                          icon={Package}
                          label={p.name}
                          rightHint={p.category}
                          onSelect={() => go("/products")}
                        />
                      ))}
                  </Command.Group>
                )}

                {/* Reports shortcut for the current and yesterday's day-close */}
                <Command.Group heading={t("Ripoti", "Reports")} className="cmdk-group">
                  <CmdItem
                    icon={FileText}
                    label={t("Ripoti ya kufunga, leo", "Day-close report, today")}
                    onSelect={() => go("/report/day-close/2026-05-28")}
                  />
                </Command.Group>
              </Command.List>

              <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">↑↓</kbd>
                  {t("Pita", "Navigate")}
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">↵</kbd>
                  {t("Chagua", "Select")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">
                    ⌘K
                  </kbd>
                  {t("kufungua", "to open")}
                </span>
              </div>
            </Command>
          </div>
        </div>
      )}

      {/* Tiny CSS for cmdk groups, kept local */}
      <style>{`
        .cmdk-group [cmdk-group-heading] {
          padding: 6px 12px 4px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-muted-foreground);
          font-weight: 600;
        }
      `}</style>
    </>
  );
}

function CmdItem({
  icon: Icon,
  label,
  rightHint,
  onSelect,
  tone,
}: {
  icon: typeof ArrowRight;
  label: string;
  rightHint?: string;
  onSelect: () => void;
  tone?: "danger";
}) {
  return (
    <Command.Item
      value={`${label} ${rightHint ?? ""}`}
      onSelect={onSelect}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent ${tone === "danger" ? "text-[#E11B22]" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {rightHint && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {rightHint}
        </span>
      )}
    </Command.Item>
  );
}
