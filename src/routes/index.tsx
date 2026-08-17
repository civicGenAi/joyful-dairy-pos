import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/app/context";
import { usePrefersReducedMotion } from "@/hooks/use-local-storage";
// BACKEND: login authenticates against Supabase Auth, with a TOTP step when
// 2FA is enabled and a session-limit gate (max 2 active devices).
import { COMPANY } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { ProductShowcase } from "@/components/brand/ProductShowcase";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  EyeOff,
  Mail,
  Lock as LockIcon,
  Languages,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/api/client";
import { mfaRepo } from "@/lib/data/mfa";
import { profileRepo, deviceLabel, type DeviceSession } from "@/lib/data/profile";
import { MAX_ACTIVE_SESSIONS, consumeIdleLogoutFlag } from "@/lib/security";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in, African Joy Dairy" }] }),
  component: LoginPage,
});

type Step = "credentials" | "otp" | "sessions";

const staggerForm = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const staggerField = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

/** Three slow, softly blurred brand-green blobs drifting behind the card.
 *  Static (no animation) when the visitor prefers reduced motion. */
function AmbientGlow() {
  const reduced = usePrefersReducedMotion();
  const blobs = [
    { color: "#8CC63F", size: 420, top: "-10%", left: "-8%", duration: 22 },
    { color: "#1E7C3F", size: 360, top: "55%", left: "70%", duration: 26 },
    { color: "#2F9E44", size: 280, top: "75%", left: "-5%", duration: 30 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.22]"
          style={{ width: b.size, height: b.size, top: b.top, left: b.left, background: b.color }}
          animate={
            reduced
              ? undefined
              : { x: [0, 24, -16, 0], y: [0, -20, 16, 0], scale: [1, 1.08, 0.96, 1] }
          }
          transition={{ duration: b.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function LoginPage() {
  const { login, completeLogin, lang, setLang, t } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  // Explain why the user is back here after the 30-minute idle logout.
  useEffect(() => {
    if (consumeIdleLogoutFlag()) {
      toast.info(
        t(
          "Umetolewa baada ya dakika 30 bila matumizi. Ingia tena.",
          "You were signed out after 30 minutes of inactivity. Please sign in again.",
        ),
      );
    }
  }, [t]);

  /** After password (and OTP when needed): enforce the 2-device limit. */
  const afterAuth = async () => {
    const list = await profileRepo.sessions();
    if (list.length > MAX_ACTIVE_SESSIONS) {
      setSessions(list);
      setStep("sessions");
      return;
    }
    await finalize();
  };

  /** Last stage: load the profile, unlock the app, go to the dashboard. */
  const finalize = async () => {
    const u = await completeLogin();
    toast.success(t(`Karibu, ${u.name.split(" ")[0]}`, `Welcome, ${u.name.split(" ")[0]}`));
    nav({ to: u.roles[0] === "route" ? "/van" : "/dashboard" });
  };

  /** Abandons a half-finished sign-in (OTP or session gate). */
  const cancelLogin = async () => {
    await supabase.auth.signOut();
    setMfaFactorId(null);
    setSessions([]);
    setStep("credentials");
  };

  const enter = async () => {
    setSubmitting(true);
    try {
      const { mfaFactorId: factor } = await login(email, password);
      if (factor) {
        setMfaFactorId(factor);
        setStep("otp");
      } else {
        await afterAuth();
      }
    } catch {
      toast.error(t("Barua pepe au nenosiri si sahihi", "Email or password is incorrect"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left brand panel, interactive + animated */}
      <BrandPanel />

      {/* Right sign-in */}
      <div className="relative flex items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-12 bg-background">
        <AmbientGlow />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Header row, mobile shows the logo here since the brand panel is hidden */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 lg:block">
              <div className="lg:hidden">
                <JoyLogo size={36} showWordmark={false} />
              </div>
              <div>
                <div className="font-display text-xl sm:text-2xl font-bold">
                  {step === "credentials" && t("Karibu tena", "Welcome back")}
                  {step === "otp" && t("Uthibitisho wa hatua mbili", "Two-factor verification")}
                  {step === "sessions" && t("Kikomo cha vifaa", "Device limit reached")}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {step === "credentials" &&
                    t("Ingia mara moja, endesha kila kitu", "One login, the whole operation.")}
                  {step === "otp" &&
                    t("Akaunti hii inalindwa na 2FA", "This account is protected by 2FA")}
                  {step === "sessions" &&
                    t(
                      `Akaunti inaruhusu vifaa ${MAX_ACTIVE_SESSIONS} tu kwa wakati mmoja`,
                      `The account allows only ${MAX_ACTIVE_SESSIONS} active devices at a time`,
                    )}
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

          <div className="relative rounded-2xl border border-border/60 bg-card/70 shadow-[0_8px_40px_-12px_rgba(30,124,63,0.25)] backdrop-blur-xl p-5 sm:p-6">
            {/* Thin brand-gradient accent along the top edge */}
            <div
              className="absolute inset-x-6 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, #1E7C3F, #8CC63F, transparent)",
              }}
            />

            <AnimatePresence mode="wait">
              {step === "credentials" && (
                <motion.form
                  key="credentials"
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  variants={staggerForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    enter();
                  }}
                  className="space-y-4"
                >
                  <motion.div variants={staggerField} className="space-y-1.5">
                    <Label
                      htmlFor="email"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t("Barua pepe", "Email")}
                    </Label>
                    <div className="group relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-[#1E7C3F]" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-[#1E7C3F]/40 focus-visible:border-[#1E7C3F]/50"
                        placeholder="name@africanjoy.co.tz"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={staggerField} className="space-y-1.5">
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
                    <div className="group relative">
                      <LockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-[#1E7C3F]" />
                      <Input
                        id="pwd"
                        type={showPwd ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 pl-10 pr-10 transition-shadow focus-visible:ring-2 focus-visible:ring-[#1E7C3F]/40 focus-visible:border-[#1E7C3F]/50"
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
                  </motion.div>

                  <motion.div variants={staggerField} className="flex items-center space-x-2">
                    <Checkbox id="remember" />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                    >
                      {t("Kumbuka akaunti yangu", "Remember me")}
                    </label>
                  </motion.div>

                  <motion.div variants={staggerField}>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-11 rounded-xl text-white font-semibold border-0 transition-transform duration-150 hover:scale-[1.015] hover:shadow-lg hover:shadow-[#1E7C3F]/25 active:scale-[0.985]"
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
                        <span>{t("Ingia", "Sign in")}</span>
                      )}
                    </Button>
                  </motion.div>
                </motion.form>
              )}

              {step === "otp" && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <OtpStep factorId={mfaFactorId} onVerified={afterAuth} onCancel={cancelLogin} />
                </motion.div>
              )}

              {step === "sessions" && (
                <motion.div
                  key="sessions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <SessionGate
                    sessions={sessions}
                    onChanged={setSessions}
                    onContinue={finalize}
                    onCancel={cancelLogin}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ---- Step 2: TOTP / recovery code -----------------------------------------

function OtpStep({
  factorId,
  onVerified,
  onCancel,
}: {
  factorId: string | null;
  onVerified: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const { t } = useApp();
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      if (useRecovery) {
        const ok = await mfaRepo.useRecoveryCode(code);
        if (!ok) {
          toast.error(t("Namba ya uokoaji si sahihi", "Recovery code is not valid"));
          return;
        }
        toast.success(
          t(
            "2FA imewekwa upya. Iwashe tena kwenye profaili yako.",
            "2FA has been reset. Re-enable it from your profile.",
          ),
        );
      } else {
        if (!factorId) throw new Error("no-factor");
        await mfaRepo.verifyLoginOtp(factorId, code.trim());
      }
      await onVerified();
    } catch {
      toast.error(
        useRecovery
          ? t("Imeshindikana, jaribu tena", "Could not verify, try again")
          : t("Namba ya OTP si sahihi", "The OTP code is incorrect"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1E7C3F]/10">
          <ShieldCheck className="h-5 w-5 text-[#1E7C3F]" />
        </span>
        <p className="text-xs text-muted-foreground">
          {useRecovery
            ? t(
                "Weka moja ya namba zako za uokoaji. Itaweka 2FA upya kwenye akaunti hii.",
                "Enter one of your recovery codes. It will reset 2FA on this account.",
              )
            : t(
                "Fungua programu yako ya uthibitisho (Google Authenticator, Authy...) na uweke namba ya tarakimu 6.",
                "Open your authenticator app (Google Authenticator, Authy...) and enter the 6-digit code.",
              )}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="otp"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {useRecovery ? t("Namba ya uokoaji", "Recovery code") : t("Namba ya OTP", "OTP code")}
        </Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="otp"
            autoFocus
            autoComplete="one-time-code"
            inputMode={useRecovery ? "text" : "numeric"}
            maxLength={useRecovery ? 14 : 6}
            value={code}
            onChange={(e) =>
              setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ""))
            }
            className="h-11 pl-10 font-mono tracking-[0.3em]"
            placeholder={useRecovery ? "XXXX-XXXX-XXXX" : "000000"}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={busy || code.length < (useRecovery ? 10 : 6)}
        className="w-full h-11 rounded-xl text-white font-semibold border-0"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #2F9E44 55%, #8CC63F)" }}
      >
        {busy ? t("Inathibitisha…", "Verifying…") : t("Thibitisha", "Verify")}
      </Button>

      <div className="flex items-center justify-between text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode("");
          }}
          className="text-[#1E7C3F] hover:underline"
        >
          {useRecovery
            ? t("Tumia namba ya OTP", "Use an OTP code instead")
            : t("Tumia namba ya uokoaji", "Use a recovery code")}
        </button>
        <button
          type="button"
          onClick={() => void onCancel()}
          className="text-muted-foreground hover:underline"
        >
          {t("Rudi nyuma", "Back to sign in")}
        </button>
      </div>
    </form>
  );
}

// ---- Step 3: max 2 active devices ------------------------------------------

function SessionGate({
  sessions,
  onChanged,
  onContinue,
  onCancel,
}: {
  sessions: DeviceSession[];
  onChanged: (s: DeviceSession[]) => void;
  onContinue: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const { t } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const others = sessions.filter((s) => !s.current);
  const canContinue = sessions.length <= MAX_ACTIVE_SESSIONS;

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await profileRepo.revokeSession(id);
      onChanged(await profileRepo.sessions());
      toast.success(t("Kifaa kimetolewa", "Device signed out"));
    } catch {
      toast.error(t("Imeshindikana kutoa kifaa", "Could not sign out the device"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t(
          "Akaunti hii tayari ina vikao kwenye vifaa vingine. Toa kifaa kimoja ili kuendelea hapa.",
          "This account already has sessions on other devices. Sign one out to continue here.",
        )}
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {others.map((s) => (
          <li key={s.id} className="flex items-center gap-3 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary">
              <MonitorSmartphone className="h-4 w-4 text-[#1E7C3F]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{deviceLabel(s.userAgent)}</div>
              <div className="text-xs text-muted-foreground">
                {s.ip ? `${s.ip} · ` : ""}
                {t("Mwisho", "Last active")}: {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === s.id}
              onClick={() => revoke(s.id)}
              className="h-8 text-xs text-[#E11B22]"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              {busyId === s.id ? t("Inatoa…", "Removing…") : t("Toa", "Sign out")}
            </Button>
          </li>
        ))}
      </ul>

      <Button
        disabled={!canContinue || continuing}
        onClick={async () => {
          setContinuing(true);
          try {
            await onContinue();
          } finally {
            setContinuing(false);
          }
        }}
        className="w-full h-11 rounded-xl text-white font-semibold border-0 disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #2F9E44 55%, #8CC63F)" }}
      >
        {canContinue
          ? continuing
            ? t("Inaingia…", "Signing in…")
            : t("Endelea", "Continue")
          : t("Toa kifaa kimoja kwanza", "Sign out one device first")}
      </Button>

      <button
        type="button"
        onClick={() => void onCancel()}
        className="w-full text-center text-[11px] font-semibold text-muted-foreground hover:underline"
      >
        {t("Ghairi na urudi nyuma", "Cancel and go back")}
      </button>
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
          <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">
            Dairy &middot; Arusha
          </div>
        </div>
      </div>

      {/* Bottom: small footer */}
      <div className="relative z-20 text-xs opacity-75">
        &copy; {new Date().getFullYear()} {COMPANY.name}.
      </div>
    </div>
  );
}
