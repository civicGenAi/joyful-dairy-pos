import {
  Search,
  Bell,
  Languages,
  LogOut,
  X,
  Menu,
  Settings,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  UserCircle2,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/app/context";
// BACKEND: live data via src/lib/data hooks; ROLE_LABEL is static UI config.
import { ROLE_LABEL } from "@/mock/data";
import { useCustomers } from "@/lib/data/hooks/customers";
import { useFarmers } from "@/lib/data/hooks/farmers";
import { useProducts } from "@/lib/data/hooks/products";
import { useAlerts } from "@/lib/data/hooks/reports";
import { useAlertReads, useMarkAlertsRead } from "@/lib/data/hooks/profile";
import { useStock } from "@/lib/data/hooks/stock";
import { useLocations } from "@/lib/data/hooks/locations";
import { navGroupsFor } from "@/lib/nav";
import type { Customer, Farmer, Product } from "@/mock/types";
import type { Role } from "@/mock/types";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMemo, useState } from "react";

export function Topbar({
  title,
  onOpenMobileNav,
}: {
  title: string;
  onOpenMobileNav?: () => void;
}) {
  const { user, lang, setLang, logout, t, can, theme, setTheme } = useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Refetches only the queries currently in use on screen, so this reloads
  // exactly the page the user is looking at, not the whole app's cache.
  const refreshPage = async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ type: "active" });
    } finally {
      setRefreshing(false);
    }
  };
  // Search + alerts tolerate missing read capability: errors render as empty.
  const customers = useCustomers().data ?? [];
  const farmers = useFarmers().data ?? [];
  const products = useProducts().data ?? [];
  const stock = useStock().data ?? [];
  const locations = useLocations().data ?? [];
  const alerts = useAlerts().data ?? [];
  const reads = useAlertReads().data ?? [];
  const markRead = useMarkAlertsRead();
  const unread = alerts.filter((a) => !reads.includes(a.id));

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    const modules = navGroupsFor(can)
      .flatMap((g) => g.items)
      .filter(
        (it) => it.label.toLowerCase().includes(needle) || it.sw.toLowerCase().includes(needle),
      )
      .slice(0, 4)
      .map((it) => ({ id: it.to, name: lang === "sw" ? it.sw : it.label, to: it.to }));
    return {
      modules,
      customers: customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.phone.includes(q.trim()) ||
            (c.email ?? "").toLowerCase().includes(needle),
        )
        .slice(0, 4),
      farmers: farmers
        .filter(
          (f) => f.name.toLowerCase().includes(needle) || f.village.toLowerCase().includes(needle),
        )
        .slice(0, 4),
      products: products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.swName.toLowerCase().includes(needle) ||
            p.category.toLowerCase().includes(needle),
        )
        .slice(0, 4),
      stock: stock
        .filter(
          (s) =>
            s.name.toLowerCase().includes(needle) ||
            (s.swName ?? "").toLowerCase().includes(needle),
        )
        .slice(0, 4),
      locations: locations.filter((l) => l.name.toLowerCase().includes(needle)).slice(0, 3),
      receiptId: /^(rct|dep|pay)-/i.test(q.trim()) ? q.trim().toUpperCase() : null,
    };
  }, [q, can, lang, customers, farmers, products, stock, locations]);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 border-b border-border bg-background/85 backdrop-blur px-3 sm:px-4 lg:px-6 h-16">
      {onOpenMobileNav && (
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden rounded-lg p-2 -ml-1 hover:bg-accent"
          aria-label={t("Fungua menyu", "Open menu")}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-base sm:text-lg font-semibold truncate">{title}</h1>
      </div>

      <Popover open={!!results} onOpenChange={(o) => !o && setQ("")}>
        <PopoverTrigger asChild>
          <div className="hidden md:flex relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) {
                  setQ("");
                  nav({ to: "/search", search: { q: q.trim() } });
                }
              }}
              placeholder={t(
                "Tafuta wateja, bidhaa, wafugaji…",
                "Search customers, products, farmers…",
              )}
              className="pl-9 pr-8 bg-secondary/60 border-transparent focus-visible:border-border"
            />
            {q ? (
              <button
                onClick={() => setQ("")}
                aria-label={t("Futa utafutaji", "Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-accent"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded bg-background border border-border px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground pointer-events-none"
                title={t("Bonyeza Ctrl+K kufungua amri", "Press Ctrl+K to open command menu")}
              >
                ⌘K
              </kbd>
            )}
          </div>
        </PopoverTrigger>
        {results && (
          <PopoverContent
            align="end"
            className="w-[340px] p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SearchResults
              results={results}
              onClose={() => setQ("")}
              onPick={(to) => {
                setQ("");
                nav({ to });
              }}
            />
          </PopoverContent>
        )}
      </Popover>

      <button
        onClick={() => void refreshPage()}
        disabled={refreshing}
        className="rounded-lg border border-border bg-card p-2 hover:bg-accent disabled:opacity-60"
        title={t("Onyesha upya ukurasa huu", "Refresh this page")}
        aria-label={t("Onyesha upya ukurasa huu", "Refresh this page")}
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>

      <button
        onClick={() => setLang(lang === "sw" ? "en" : "sw")}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
        title={t("Badilisha lugha", "Toggle language")}
      >
        <Languages className="h-3.5 w-3.5" />
        {lang.toUpperCase()}
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="relative rounded-lg border border-border bg-card p-2 hover:bg-accent"
            aria-label={t("Arifa", "Notifications")}
          >
            <Bell className="h-4 w-4" />
            {unread.length > 0 && (
              <span
                className="absolute -top-1 -right-1 grid place-items-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white"
                style={{ background: "#E11B22" }}
              >
                {unread.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("Arifa", "Notifications")}</div>
              <div className="text-xs text-muted-foreground">
                {unread.length} {t("mpya", "unread")} · {alerts.length} {t("jumla", "total")}
              </div>
            </div>
            {unread.length > 0 && (
              <button
                onClick={() => markRead.mutate(unread.map((a) => a.id))}
                className="text-[11px] font-semibold text-[#1E7C3F] hover:underline"
              >
                {t("Soma zote", "Mark all as read")}
              </button>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {alerts.map((a) => {
              const link =
                a.kind === "low-stock"
                  ? "/stock"
                  : a.kind === "overdue-credit"
                    ? "/customers"
                    : a.kind === "farmer-payable"
                      ? "/farmers"
                      : "/reconciliation";
              const isRead = reads.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      if (!isRead) markRead.mutate([a.id]);
                      nav({ to: link });
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/60 ${isRead ? "opacity-55" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${a.severity === "danger" ? "bg-[#E11B22]" : a.severity === "warning" ? "bg-[#E5A100]" : "bg-[#1D9E75]"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                          {a.timeAgo}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-9 w-9 rounded-full object-cover border border-border"
              />
            ) : (
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-white text-sm font-bold"
                style={{ background: user.avatarColor }}
              >
                {user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
            <span className="hidden lg:inline text-sm font-medium">{user.name.split(" ")[0]}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-muted-foreground font-normal">{user.email}</div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {user.roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px]">
                  {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
                </Badge>
              ))}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Language switcher inside the user menu */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setLang(lang === "sw" ? "en" : "sw");
            }}
          >
            <Languages className="h-4 w-4 mr-2" />
            <span className="flex-1">{t("Lugha", "Language")}</span>
            <span className="text-[10px] font-semibold rounded-md bg-secondary px-1.5 py-0.5">
              {lang === "sw" ? "Kiswahili" : "English"}
            </span>
          </DropdownMenuItem>

          {/* Theme switcher, three-way: light / dark / system */}
          <div className="px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">
              {t("Mwonekano", "Theme")}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: "light", icon: Sun, label: t("Mwanga", "Light") },
                  { id: "dark", icon: Moon, label: t("Giza", "Dark") },
                  { id: "system", icon: Monitor, label: t("Mfumo", "System") },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${active ? "bg-[#1E7C3F] text-white" : "bg-secondary text-foreground hover:bg-accent"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* My profile, available to every signed-in user */}
          <DropdownMenuItem onClick={() => nav({ to: "/profile" })}>
            <UserCircle2 className="h-4 w-4 mr-2" />
            {t("Profaili yangu", "My profile")}
          </DropdownMenuItem>

          {/* Settings gear, only when the user can reach it */}
          {can("settings:write") && (
            <DropdownMenuItem onClick={() => nav({ to: "/settings" })}>
              <Settings className="h-4 w-4 mr-2" />
              {t("Mipangilio", "Settings")}
            </DropdownMenuItem>
          )}

          {/* Help & glossary, always available */}
          <DropdownMenuItem onClick={() => nav({ to: "/help" })}>
            <HelpCircle className="h-4 w-4 mr-2" />
            {t("Msaada", "Help & glossary")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <ConfirmDialog
            title={t("Toka kwenye African Joy POS?", "Log out of African Joy POS?")}
            description={t(
              "Utahitaji kuingia tena kuendelea.",
              "You will need to sign in again to continue.",
            )}
            confirmLabel={t("Toka", "Sign out")}
            onConfirm={() => {
              logout();
              nav({ to: "/" });
            }}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-[#E11B22] focus:text-[#E11B22]"
              >
                <LogOut className="h-4 w-4 mr-2" /> {t("Toka", "Sign out")}
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function SearchResults({
  results,
  onPick,
  onClose,
}: {
  results: {
    modules: { id: string; name: string; to: string }[];
    customers: Customer[];
    farmers: Farmer[];
    products: Product[];
    stock: { id: string; name: string }[];
    locations: { id: string; name: string }[];
    receiptId: string | null;
  };
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const total =
    results.modules.length +
    results.customers.length +
    results.farmers.length +
    results.products.length +
    results.stock.length +
    results.locations.length +
    (results.receiptId ? 1 : 0);
  if (total === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {t("Hakuna matokeo", "No matches")}
      </div>
    );
  }
  const Group = ({
    title,
    items,
    to,
  }: {
    title: string;
    items: { id: string; name: string }[];
    to: string;
  }) =>
    items.length ? (
      <div className="p-2">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </div>
        <ul>
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onPick(to)}
                className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                {it.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="max-h-[420px] overflow-y-auto">
      {results.modules.length > 0 && (
        <div className="p-2">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t("Moduli", "Modules")}
          </div>
          <ul>
            {results.modules.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => onPick(m.to)}
                  className="w-full text-left rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.receiptId && (
        <div className="p-2 border-b border-border">
          <button
            onClick={() =>
              onPick(
                results.receiptId!.startsWith("DEP-")
                  ? `/receipt/deposit/${results.receiptId}`
                  : `/receipt/${results.receiptId}`,
              )
            }
            className="w-full text-left rounded-md px-2 py-1.5 text-sm font-semibold text-[#1E7C3F] hover:bg-accent"
          >
            {t("Fungua risiti", "Open receipt")} {results.receiptId} →
          </button>
        </div>
      )}
      <Group title={t("Wateja", "Customers")} items={results.customers} to="/customers" />
      <Group title={t("Wafugaji", "Farmers")} items={results.farmers} to="/farmers" />
      <Group title={t("Bidhaa", "Products")} items={results.products} to="/products" />
      <Group title={t("Stock", "Stock items")} items={results.stock} to="/stock" />
      <Group title={t("Maeneo", "Locations")} items={results.locations} to="/settings" />
      <div className="border-t border-border p-2">
        <button
          onClick={() => onPick("/search")}
          className="w-full text-left rounded-md px-2 py-1.5 text-xs font-semibold text-[#1E7C3F] hover:bg-accent"
        >
          {t("Tazama matokeo yote, bonyeza Enter", "View all results, press Enter")} →
        </button>
      </div>
    </div>
  );
}
