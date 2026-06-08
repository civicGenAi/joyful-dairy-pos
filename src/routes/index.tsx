import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useApp } from "@/app/context";
import { USERS, ROLE_LABEL, COMPANY } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { ProductShowcase } from "@/components/brand/ProductShowcase";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Lock as LockIcon,
  Languages,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in, African Joy Dairy" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, lang, setLang, t } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@africanjoy.co.tz");
  const [password, setPassword] = useState("joy1234");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const enter = async (e?: string) => {
    const addr = e ?? email;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 350));
    login(addr);
    const u = USERS.find((x) => x.email === addr);
    toast.success(t(`Karibu, ${u?.name.split(" ")[0]}`, `Welcome, ${u?.name.split(" ")[0]}`));
    nav({ to: u?.roles[0] === "route" ? "/van" : "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left brand panel, interactive + animated */}
      <BrandPanel />

      {/* Right sign-in */}
      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Header row, mobile shows the logo here since the brand panel is hidden */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 lg:block">
              <div className="lg:hidden">
                <JoyLogo size={36} showWordmark={false} />
              </div>
              <div>
                <div className="font-display text-xl sm:text-2xl font-bold">
                  {t("Karibu tena", "Welcome back")}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {t("Ingia kwenye mfumo wa African Joy", "Sign in to the African Joy system")}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLang(lang === "sw" ? "en" : "sw")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
              title={t("Badilisha lugha", "Toggle language")}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang.toUpperCase()}
            </button>
          </div>

          <div className="rounded-2xl bg-card border border-border shadow-card p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enter();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t("Barua pepe", "Email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10"
                    placeholder="name@africanjoy.co.tz"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="pwd"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {t("Nenosiri", "Password")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => toast(t("Wasiliana na admin", "Contact your admin"))}
                    className="text-[11px] font-semibold text-[#1E7C3F] hover:underline"
                  >
                    {t("Umesahau?", "Forgot?")}
                  </button>
                </div>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pwd"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-accent text-muted-foreground"
                    aria-label={showPwd ? t("Ficha", "Hide") : t("Onyesha", "Show")}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                >
                  {t("Kumbuka akaunti yangu", "Remember me")}
                </label>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl text-white font-semibold border-0"
                style={{
                  background: "linear-gradient(135deg, #1E7C3F, #2F9E44 55%, #8CC63F)",
                }}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    {t("Inaingia…", "Signing in…")}
                  </span>
                ) : (
                  <span>
                    {t("Ingia", "Sign in")}
                  </span>
                )}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("Au ingia haraka kama", "Or quick demo as")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {USERS.slice(0, 7).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => enter(u.email)}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-2 text-left hover:border-[#2F9E44] transition-colors"
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white shrink-0"
                    style={{ background: u.avatarColor }}
                  >
                    {u.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold truncate">
                      {lang === "sw" ? ROLE_LABEL[u.roles[0]].sw : ROLE_LABEL[u.roles[0]].en}
                    </span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {u.email.split("@")[0]}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-[#1E7C3F] shrink-0" />
              <span>
                {t("Tumia nenosiri ", "Use password ")}
                <code className="font-num font-semibold text-foreground">joy1234</code>
                {t(" kwa akaunti zote za demo.", " for all demo accounts.")}
              </span>
            </div>
          </div>


        </motion.div>
      </div>
    </div>
  );
}

// ---- Brand panel ----------------------------------------------------------

function BrandPanel() {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 text-white overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #14532D 0%, #1E7C3F 45%, #2F9E44 80%, #8CC63F 130%)",
      }}
    >
      {/* Background Showcase */}
      <ProductShowcase
        aspect=""
        rounded="rounded-none"
        className="absolute inset-0 z-0"
        interval={4000}
        showCaption={false}
      />

      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Top: brand */}
      <div className="relative z-20 flex items-center gap-3">
        <JoyLogo size={48} showWordmark={false} inlineOnly={false} />
        <div>
          <div className="font-display text-xl font-bold leading-none">African Joy</div>
          <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">Dairy &middot; Arusha</div>
        </div>
      </div>

      {/* Bottom: small footer */}
      <div className="relative z-20 text-xs opacity-75">
        &copy; {new Date().getFullYear()} {COMPANY.name}.
      </div>
    </div>
  );
}
