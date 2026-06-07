import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useApp } from "@/app/context";
import { USERS, ROLE_LABEL, COMPANY } from "@/mock/data";
import type { Role } from "@/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, LogIn } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in — African Joy Dairy" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, lang, setLang, t } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@africanjoy.co.tz");
  const [password, setPassword] = useState("joy1234");

  const enter = (e?: string) => {
    const addr = e ?? email;
    login(addr);
    const u = USERS.find((x) => x.email === addr);
    toast.success(t(`Karibu, ${u?.name.split(" ")[0]}`, `Welcome, ${u?.name.split(" ")[0]}`));
    nav({ to: u?.roles[0] === "route" ? "/van" : "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left brand panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 text-white"
        style={{ background: "linear-gradient(135deg, #14532D 0%, #1E7C3F 45%, #2F9E44 80%, #8CC63F 130%)" }}
      >
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }} />
        <div className="relative">
          <div className="inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 8c0-1.5 2-3 7-3s7 1.5 7 3v8c0 1.5-2 3-7 3s-7-1.5-7-3V8z"/></svg>
            </div>
            <div>
              <div className="font-display text-xl font-bold leading-none">African Joy</div>
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">Dairy · Arusha</div>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="relative max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E11B22" }} /> Tanzania
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight mt-4">
            {t("Maziwa bora, kuwawezesha wafugaji wanawake.", "Premium dairy, empowering women farmers.")}
          </h2>
          <p className="mt-3 text-white/85 leading-relaxed">
            {t(
              "Mfumo kamili wa uzalishaji, mauzo, ghala na fedha — kwa lugha ya Kiswahili na Kiingereza.",
              "An end-to-end system for production, sales, store and finance — built bilingual for our team."
            )}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { n: "880L", l: t("Yamekusanywa leo", "Collected today") },
              { n: "TZS 1.4M", l: t("Mauzo leo", "Sales today") },
              { n: "12", l: t("Wateja mkopo", "Credit clients") },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/10 backdrop-blur px-3 py-3">
                <div className="font-num text-lg font-bold">{s.n}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="relative text-xs opacity-75">{COMPANY.footer}</div>
      </div>

      {/* Right sign-in */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-display text-2xl font-bold">{t("Karibu tena", "Welcome back")}</div>
              <div className="text-sm text-muted-foreground">{t("Ingia kwenye mfumo wa African Joy", "Sign in to the African Joy system")}</div>
            </div>
            <button
              onClick={() => setLang(lang === "sw" ? "en" : "sw")}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold"
            >{lang.toUpperCase()}</button>
          </div>

          <div className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("Barua pepe", "Email")}</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">{t("Nenosiri", "Password")}</Label>
                <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button
                onClick={() => enter()}
                className="w-full h-11 rounded-xl text-white font-semibold border-0"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #2F9E44 55%, #8CC63F)" }}
              >
                <LogIn className="h-4 w-4 mr-1.5" />
                {t("Ingia", "Sign in")}
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("Au ingia haraka kama", "Or quick demo as")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {USERS.slice(0, 7).map((u) => (
                <button
                  key={u.id}
                  onClick={() => enter(u.email)}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-left hover:border-[color:var(--color-brand-green-500)] transition-colors"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: u.avatarColor }}>
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold truncate">{lang === "sw" ? ROLE_LABEL[u.roles[0]].sw : ROLE_LABEL[u.roles[0]].en}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">{u.email.split("@")[0]}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
              <Briefcase className="h-3.5 w-3.5 mt-0.5" />
              {t(
                "Tumia nenosiri ", "Use password "
              )}
              <code className="font-num font-semibold text-foreground">joy1234</code>
              {t(" kwa akaunti zote za demo.", " for all demo accounts.")}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
