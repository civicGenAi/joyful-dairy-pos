import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import type { Role, User } from "@/mock/types";
import { capabilitiesFor, hasCap, type Capability } from "@/lib/auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
// BACKEND: auth now flows through Supabase (src/lib/data/auth.ts), not @/mock/data.
import { authRepo } from "@/lib/data/auth";
import { supabase } from "@/lib/api/client";
import {
  startIdleLogout,
  clearActivityMarker,
  installInspectGuard,
  startRouteSessionCap,
  markRouteSessionStart,
  clearRouteSessionStart,
} from "@/lib/security";

type Lang = "sw" | "en";
type Theme = "light" | "dark" | "system";

interface AppCtx {
  user: User | null;
  /** False until the persisted session has been checked on page load. */
  authReady: boolean;
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
  /**
   * Stage 1 of sign-in: password only. Returns the TOTP factor id when the
   * account needs the OTP step. The user is NOT considered signed in until
   * completeLogin() runs (after OTP and the session-limit gate).
   */
  login: (email: string, password: string) => Promise<{ mfaFactorId: string | null }>;
  /** Final stage of sign-in: loads the profile and unlocks the app. */
  completeLogin: () => Promise<User>;
  logout: () => void;
  /** Re-fetches the signed-in profile (after avatar or name changes). */
  refreshUser: () => Promise<void>;
  setRole: (r: Role) => void;
  resetRole: () => void;
  setLang: (l: Lang) => void;
  setTheme: (theme: Theme) => void;
  t: (sw: string, en: string) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [viewAs, setViewAs] = useState<Role>("admin");
  const [lang, setLang] = useLocalStorage<Lang>("ajd:lang", "sw");
  const [theme, setTheme] = useLocalStorage<Theme>("ajd:theme", "light");
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Restore the Supabase session once on load, then track sign-outs
  // (e.g. token expiry or sign-out from another tab).
  useEffect(() => {
    let cancelled = false;
    authRepo
      .restore()
      .then((u) => {
        if (cancelled) return;
        if (u) {
          setUser(u);
          setViewAs(u.roles[0]);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setUser(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 30-minute idle auto-logout: any activity in any tab resets the timer.
  // On timeout we sign out and hard-reload to the login page so every cache,
  // timer and in-memory state is reset cleanly.
  useEffect(() => {
    if (!user) return;
    const stop = startIdleLogout(() => {
      void authRepo
        .signOut()
        .catch(() => {})
        .finally(() => {
          clearActivityMarker();
          window.location.assign("/");
        });
    });
    return stop;
  }, [user]);

  // Route/driver accounts get a hard 12-hour session cap on top of the idle
  // timeout: still active or not, a driver signs back in once a day. Office
  // roles are unaffected, this only runs when "route" is among the roles.
  useEffect(() => {
    if (!user?.roles.includes("route")) return;
    const stop = startRouteSessionCap(() => {
      void authRepo
        .signOut()
        .catch(() => {})
        .finally(() => {
          clearActivityMarker();
          clearRouteSessionStart();
          window.location.assign("/");
        });
    });
    return stop;
  }, [user]);

  // Internal-system lockdown (production builds only).
  useEffect(() => installInspectGuard(), []);

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
      authReady,
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
      login: (email: string, password: string) => authRepo.signInPassword(email, password),
      completeLogin: async () => {
        const u = await authRepo.completeSignIn();
        setUser(u);
        setViewAs(u.roles[0]);
        // A fresh sign-in starts the 12-hour route session clock; harmless
        // to stamp for every role, only route accounts ever check it.
        markRouteSessionStart();
        return u;
      },
      logout: () => {
        void authRepo.signOut();
        clearActivityMarker();
        clearRouteSessionStart();
        setUser(null);
      },
      refreshUser: async () => {
        const u = await authRepo.restore();
        if (u) setUser(u);
      },
      setRole: setViewAs,
      resetRole: () => user && setViewAs(user.roles[0]),
      setLang,
      setTheme,
      t: (sw, en) => (lang === "sw" ? sw : en),
    };
  }, [user, authReady, viewAs, lang, theme, resolvedTheme, setLang, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

export { hasCap };
