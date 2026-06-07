import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { USERS } from "@/mock/data";
import type { Role, User } from "@/mock/types";

type Lang = "sw" | "en";

interface AppCtx {
  user: User | null;
  role: Role;
  lang: Lang;
  login: (email: string) => void;
  logout: () => void;
  setRole: (r: Role) => void;
  setLang: (l: Lang) => void;
  t: (sw: string, en: string) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("admin");
  const [lang, setLang] = useState<Lang>("sw");

  const value = useMemo<AppCtx>(() => ({
    user,
    role,
    lang,
    login: (email: string) => {
      const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase()) ?? USERS[0];
      setUser(u);
      setRole(u.roles[0]);
    },
    logout: () => setUser(null),
    setRole,
    setLang,
    t: (sw, en) => (lang === "sw" ? sw : en),
  }), [user, role, lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}
