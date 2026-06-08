import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { USERS } from "@/mock/data";
import type { Role, User } from "@/mock/types";
import { capabilitiesFor, hasCap, type Capability } from "@/lib/auth";
import { useLocalStorage } from "@/hooks/use-local-storage";

type Lang = "sw" | "en";

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
  login: (email: string) => void;
  logout: () => void;
  setRole: (r: Role) => void;
  resetRole: () => void;
  setLang: (l: Lang) => void;
  t: (sw: string, en: string) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [viewAs, setViewAs] = useState<Role>("admin");
  const [lang, setLang] = useLocalStorage<Lang>("ajd:lang", "sw");

  // Keep <html lang> in sync so screen readers and search bots pick the right
  // language pronunciation/indexing automatically.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang === "sw" ? "sw" : "en");
    }
  }, [lang]);

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
      login: (email: string) => {
        const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase()) ?? USERS[0];
        setUser(u);
        setViewAs(u.roles[0]);
      },
      logout: () => setUser(null),
      setRole: setViewAs,
      resetRole: () => user && setViewAs(user.roles[0]),
      setLang,
      t: (sw, en) => (lang === "sw" ? sw : en),
    };
  }, [user, viewAs, lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

export { hasCap };
