import {
  Search,
  Bell,
  ChevronDown,
  Languages,
  LogOut,
  UserCog,
  ArrowLeftRight,
  X,
  Menu,
  Settings,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useApp } from "@/app/context";
import { ALERTS, ROLE_LABEL, USERS, CUSTOMERS, FARMERS, PRODUCTS } from "@/mock/data";
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

const ROLES: Role[] = ["admin", "finance", "production", "sales", "route", "store", "viewer"];

export function Topbar({
  title,
  onOpenMobileNav,
}: {
  title: string;
  onOpenMobileNav?: () => void;
}) {
  const { user, role, setRole, resetRole, lang, setLang, logout, t, roles, can, theme, setTheme } =
    useApp();
  const nav = useNavigate();
  const isAdmin = roles.includes("admin");
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return {
      customers: CUSTOMERS.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 4),
      farmers: FARMERS.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 4),
      products: PRODUCTS.filter(
        (p) => p.name.toLowerCase().includes(needle) || p.swName.toLowerCase().includes(needle),
      ).slice(0, 4),
    };
  }, [q]);

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
              placeholder={t(
                "Tafuta wateja, bidhaa, wafugaji…",
                "Search customers, products, farmers…",
              )}
              className="pl-9 pr-8 bg-secondary/60 border-transparent focus-visible:border-border"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label={t("Futa utafutaji", "Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-accent"
              >
                <X className="h-3 w-3" />
              </button>
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
            <span
              className="absolute -top-1 -right-1 grid place-items-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white"
              style={{ background: "#E11B22" }}
            >
              {ALERTS.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold">{t("Arifa", "Notifications")}</div>
            <div className="text-xs text-muted-foreground">
              {ALERTS.length} {t("zinazohitaji uangalizi", "items need attention")}
            </div>
          </div>
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {ALERTS.map((a) => {
              const link =
                a.kind === "low-stock"
                  ? "/stock"
                  : a.kind === "overdue-credit"
                    ? "/customers"
                    : a.kind === "farmer-payable"
                      ? "/farmers"
                      : "/reconciliation";
              return (
                <li key={a.id}>
                  <button
                    onClick={() => nav({ to: link })}
                    className="w-full text-left px-4 py-3 hover:bg-accent/60"
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

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              <UserCog className="h-3.5 w-3.5" />
              {t("Tazama kama", "View as")}:{" "}
              <Badge variant="secondary" className="font-semibold">
                {lang === "sw" ? ROLE_LABEL[role].sw : ROLE_LABEL[role].en}
              </Badge>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {t("Badilisha jukumu (demo)", "Switch role (demo)")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ROLES.map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => {
                  setRole(r);
                  if (r === "route") nav({ to: "/van" });
                  else nav({ to: "/dashboard" });
                }}
              >
                <span className="font-medium">
                  {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
                </span>
                {r === user.roles[0] && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {t("Yangu", "Mine")}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                resetRole();
                nav({ to: "/dashboard" });
              }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />
              {t("Rudi kwenye jukumu langu", "Reset to my role")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2">
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

          {/* Settings gear, only when the user can reach it */}
          {can("settings:write") && (
            <DropdownMenuItem onClick={() => nav({ to: "/settings" })}>
              <Settings className="h-4 w-4 mr-2" />
              {t("Mipangilio", "Settings")}
            </DropdownMenuItem>
          )}

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
  results: { customers: typeof CUSTOMERS; farmers: typeof FARMERS; products: typeof PRODUCTS };
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const total = results.customers.length + results.farmers.length + results.products.length;
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
      <Group title={t("Wateja", "Customers")} items={results.customers} to="/customers" />
      <Group title={t("Wafugaji", "Farmers")} items={results.farmers} to="/farmers" />
      <Group title={t("Bidhaa", "Products")} items={results.products} to="/products" />
    </div>
  );
}

export const ALL_USERS = USERS;
