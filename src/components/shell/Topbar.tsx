import { Search, Bell, ChevronDown, Languages, LogOut, UserCog } from "lucide-react";
import { useApp } from "@/app/context";
import { ALERTS, ROLE_LABEL, USERS } from "@/mock/data";
import type { Role } from "@/mock/types";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ROLES: Role[] = ["admin", "finance", "production", "sales", "route", "store", "viewer"];

export function Topbar({ title }: { title: string }) {
  const { user, role, setRole, lang, setLang, logout, t } = useApp();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 backdrop-blur px-4 lg:px-6 h-16">
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-lg font-semibold truncate">{title}</h1>
      </div>

      <div className="hidden md:flex relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("Tafuta wateja, bidhaa, wafugaji…", "Search customers, products, farmers…")} className="pl-9 bg-secondary/60 border-transparent focus-visible:border-border" />
      </div>

      {/* Language */}
      <button
        onClick={() => setLang(lang === "sw" ? "en" : "sw")}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
        title="Toggle language"
      >
        <Languages className="h-3.5 w-3.5" />
        {lang.toUpperCase()}
      </button>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative rounded-lg border border-border bg-card p-2 hover:bg-accent">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 grid place-items-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white" style={{ background: "#E11B22" }}>
              {ALERTS.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold">{t("Arifa", "Notifications")}</div>
            <div className="text-xs text-muted-foreground">{ALERTS.length} {t("zinazohitaji uangalizi", "items need attention")}</div>
          </div>
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {ALERTS.map((a) => (
              <li key={a.id} className="px-4 py-3 hover:bg-accent/60">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${a.severity === "danger" ? "bg-[#E11B22]" : a.severity === "warning" ? "bg-[#E5A100]" : "bg-[#1D9E75]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{a.timeAgo}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {/* View as role */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent">
            <UserCog className="h-3.5 w-3.5" />
            {t("Tazama kama", "View as")}: <Badge variant="secondary" className="font-semibold">{lang === "sw" ? ROLE_LABEL[role].sw : ROLE_LABEL[role].en}</Badge>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("Badilisha jukumu (demo)", "Switch role (demo)")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLES.map((r) => (
            <DropdownMenuItem key={r} onClick={() => { setRole(r); if (r === "route") nav({ to: "/van" }); else nav({ to: "/dashboard" }); }}>
              <span className="font-medium">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full text-white text-sm font-bold" style={{ background: user.avatarColor }}>
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <span className="hidden lg:inline text-sm font-medium">{user.name.split(" ")[0]}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-muted-foreground font-normal">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ConfirmDialog
            title={t("Toka kwenye African Joy POS?", "Log out of African Joy POS?")}
            description={t("Utahitaji kuingia tena kuendelea.", "You will need to sign in again to continue.")}
            confirmLabel={t("Toka", "Sign out")}
            onConfirm={() => { logout(); nav({ to: "/" }); }}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <LogOut className="h-4 w-4 mr-2" /> {t("Toka", "Sign out")}
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export const ALL_USERS = USERS;
