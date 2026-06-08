import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { USERS } from "@/mock/data";
import type { Role, User } from "@/mock/types";
import { capabilitiesFor, hasCap, type Capability } from "@/lib/auth";
import { useLocalStorage } from "@/hooks/use-local-storage";

type Lang = "sw" | "en";
type Theme = "light" | "dark" | "system";

interface AppCtx {
  user: User | null;
  /** All roles assigned to the user (multi-role union). */
  roles: Role[];
  /** Admin-only "view as" override. Non-admins always see role === roles[0]. */
  role: Role;
  /** Capabilities derived from the user's assigned roles, NOT from viewAs. */
  caps: Set<Capability>;
  /** Whether the user holds a capability (uses real assigned roles). */
  can: (c: Capability) => boolean;
  /** Whether the topbar should consider the screen visible for the current viewAs. */
  canView: (c: Capability) => boolean;
  lang: Lang;
  theme: Theme;
  /** The resolved theme after applying the `system` setting. */
  resolvedTheme: "light" | "dark";
  login: (email: string) => void;
  logout: () => void;
  setRole: (r: Role) => void;
  resetRole: () => void;
  setLang: (l: Lang) => void;
  setTheme: (theme: Theme) => void;
  t: (sw: string, en: string) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [viewAs, setViewAs] = useState<Role>("admin");
  const [lang, setLang] = useLocalStorage<Lang>("ajd:lang", "sw");
  const [theme, setTheme] = useLocalStorage<Theme>("ajd:theme", "light");
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Track the OS-level preference so `theme: "system"` stays in step live.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Sync <html lang> and the .dark class.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("lang", lang === "sw" ? "sw" : "en");
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const value = useMemo<AppCtx>(() => {
    const roles = user?.roles ?? [];
    const caps = capabilitiesFor(roles);
    return {
      user,
      roles,
      role: viewAs,
      caps,
      can: (c) => caps.has(c),
      // canView mirrors `can` for normal users; admins use the viewAs role's caps so the
      // sidebar / topbar reflect the role they're previewing.
      canView: (c) => (roles.includes("admin") ? capabilitiesFor([viewAs]).has(c) : caps.has(c)),
      lang,
      theme,
      resolvedTheme,
      login: (email: string) => {
        const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase()) ?? USERS[0];
        setUser(u);
        setViewAs(u.roles[0]);
      },
      logout: () => setUser(null),
      setRole: setViewAs,
      resetRole: () => user && setViewAs(user.roles[0]),
      setLang,
      setTheme,
      t: (sw, en) => (lang === "sw" ? sw : en),
    };
  }, [user, viewAs, lang, theme, resolvedTheme, setLang, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

export { hasCap };
