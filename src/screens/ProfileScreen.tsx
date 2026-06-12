import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { SectionCard, Pill } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
// BACKEND: self-service profile via src/lib/data/profile.
import {
  useUpdateOwnProfile,
  useUploadAvatar,
  useChangeOwnPassword,
  useSessions,
  useRevokeSession,
  useSignOutOtherDevices,
} from "@/lib/data/hooks/profile";
import { generateStrongPassword, passwordStrength, deviceLabel } from "@/lib/data/profile";
import {
  mfaRepo,
  mfaKeys,
  generateRecoveryCodes,
  downloadRecoveryCodes,
  type EnrollStart,
} from "@/lib/data/mfa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ROLE_LABEL } from "@/mock/data";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  KeyRound,
  Wand2,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  MonitorSmartphone,
  LogOut,
  Save,
  Download,
} from "lucide-react";

export function ProfileScreen() {
  const { t, user } = useApp();
  if (!user) return null;

  return (
    <AppShell title={t("Profaili yangu", "My profile")}>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <AccountCard />
          <TwoFactorCard />
        </div>
        <div className="space-y-4">
          <ChangePasswordCard />
          <SessionsCard />
        </div>
      </div>
    </AppShell>
  );
}

function AccountCard() {
  const { t, lang, user } = useApp();
  const update = useUpdateOwnProfile();
  const upload = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  if (!user) return null;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("Picha isizidi MB 2", "Image must be under 2 MB"));
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success(t("Picha imebadilishwa", "Avatar updated")),
      onError: () => toast.error(t("Imeshindikana kupakia picha", "Could not upload the image")),
    });
  };

  const save = () => {
    update.mutate(
      { name, phone },
      {
        onSuccess: () => toast.success(t("Profaili imehifadhiwa", "Profile saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save profile")),
      },
    );
  };

  return (
    <SectionCard title={t("Akaunti yangu", "My account")}>
      <div className="flex items-center gap-4 mb-5">
        <div className="relative">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-20 w-20 rounded-full object-cover border-2 border-[#2F9E44]"
            />
          ) : (
            <span
              className="grid h-20 w-20 place-items-center rounded-full text-2xl font-bold text-white"
              style={{ background: user.avatarColor }}
            >
              {user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#1E7C3F] text-white shadow-card hover:bg-[#14532D]"
            title={t("Badilisha picha", "Change avatar")}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFile}
          />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-bold truncate">{user.name}</div>
          <div className="text-sm text-muted-foreground truncate">{user.email}</div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {user.roles.map((r) => (
              <Pill key={r} tone="success">
                {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>{t("Jina kamili", "Full name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("Simu", "Phone")}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button
          onClick={save}
          disabled={update.isPending}
          className="text-white w-fit"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
        </Button>
      </div>
    </SectionCard>
  );
}

const STRENGTH_META = [
  { sw: "Dhaifu sana", en: "Very weak", color: "#E11B22", width: "10%" },
  { sw: "Dhaifu", en: "Weak", color: "#E11B22", width: "30%" },
  { sw: "Wastani", en: "Fair", color: "#E5A100", width: "55%" },
  { sw: "Nzuri", en: "Good", color: "#E5A100", width: "80%" },
  { sw: "Imara", en: "Strong", color: "#2F9E44", width: "100%" },
];

function ChangePasswordCard() {
  const { t, user, logout } = useApp();
  const change = useChangeOwnPassword();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const score = passwordStrength(newPwd);
  const meta = STRENGTH_META[score];

  const generate = () => {
    const pwd = generateStrongPassword();
    setNewPwd(pwd);
    setConfirm(pwd);
    setShow(true);
    toast(t("Nakili nenosiri kabla ya kuhifadhi", "Copy the password before saving"));
  };

  const save = () => {
    if (!user) return;
    if (newPwd !== confirm) {
      toast.error(t("Nenosiri jipya halifanani", "New passwords do not match"));
      return;
    }
    if (score < 4) {
      toast.error(
        t(
          "Nenosiri liwe imara: herufi 8+, kubwa na ndogo, namba na alama",
          "Password must be strong: 8+ chars with upper, lower, number and symbol",
        ),
      );
      return;
    }
    change.mutate(
      { email: user.email, oldPassword: oldPwd, newPassword: newPwd },
      {
        onSuccess: () => {
          toast.success(t("Nenosiri limebadilishwa", "Password changed"));
          setOldPwd("");
          setNewPwd("");
          setConfirm("");
        },
        onError: (e) =>
          toast.error(
            e.message.includes("wrong-old-password")
              ? t("Nenosiri la zamani si sahihi", "Old password is incorrect")
              : e.message.includes("same-password")
                ? t(
                    "Nenosiri jipya lisifanane na la zamani",
                    "New password must differ from the old one",
                  )
                : t("Imeshindikana kubadilisha", "Could not change the password"),
          ),
      },
    );
  };

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-4 w-4" /> {t("Badilisha nenosiri", "Change password")}
        </span>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>{t("Nenosiri la zamani", "Old password")}</Label>
          <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label>{t("Nenosiri jipya", "New password")}</Label>
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E7C3F] hover:underline"
            >
              <Wand2 className="h-3 w-3" />
              {t("Tengeneza imara", "Generate strong")}
            </button>
          </div>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              aria-label={show ? t("Ficha", "Hide") : t("Onyesha", "Show")}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPwd && (
            <div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: meta.width, background: meta.color }}
                />
              </div>
              <div className="text-[11px] mt-1 font-semibold" style={{ color: meta.color }}>
                {t(meta.sw, meta.en)}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label>{t("Thibitisha nenosiri jipya", "Confirm new password")}</Label>
          <Input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm && confirm !== newPwd && (
            <div className="text-[11px] text-[#E11B22]">
              {t("Halifanani na nenosiri jipya", "Does not match the new password")}
            </div>
          )}
        </div>
        <Button
          onClick={save}
          disabled={change.isPending || !oldPwd || !newPwd || !confirm}
          className="text-white w-fit"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          {change.isPending ? t("Inabadilisha…", "Changing…") : t("Badilisha", "Change password")}
        </Button>
        <div className="text-[11px] text-muted-foreground">
          {t(
            "Imara: herufi 8 au zaidi zikichanganya herufi kubwa, ndogo, namba na alama. Lisifanane na la zamani.",
            "Strong: 8+ characters mixing upper case, lower case, numbers and symbols. Must differ from the old one.",
          )}
        </div>
        {void logout}
      </div>
    </SectionCard>
  );
}

function TwoFactorCard() {
  const { t, user } = useApp();
  const qc = useQueryClient();
  const { data: status, isPending } = useQuery({
    queryKey: mfaKeys.status(),
    queryFn: mfaRepo.status,
  });

  // Enrolment wizard state.
  const [enroll, setEnroll] = useState<EnrollStart | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  // Generated before verify; hashes are stored server-side on success and the
  // plain codes shown exactly once for download.
  const [codes, setCodes] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: mfaKeys.status() });

  const start = async () => {
    setBusy(true);
    try {
      setEnroll(await mfaRepo.enrollStart());
      setOtp("");
    } catch {
      toast.error(t("Imeshindikana kuanza usanidi", "Could not start the setup"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (enroll) await mfaRepo.enrollCancel(enroll.factorId).catch(() => {});
    setEnroll(null);
    setOtp("");
  };

  const verify = async () => {
    if (!enroll) return;
    setBusy(true);
    try {
      const fresh = generateRecoveryCodes();
      await mfaRepo.enrollVerify(enroll.factorId, otp.trim(), fresh);
      setCodes(fresh);
      setShowCodes(true);
      setDownloaded(false);
      setEnroll(null);
      setOtp("");
      refresh();
      toast.success(t("2FA imewashwa", "2FA is now enabled"));
    } catch {
      toast.error(t("Namba ya OTP si sahihi", "The OTP code is incorrect"));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const fresh = generateRecoveryCodes();
      await mfaRepo.regenerateRecoveryCodes(fresh);
      setCodes(fresh);
      setShowCodes(true);
      setDownloaded(false);
      toast.success(t("Namba mpya za uokoaji zimetengenezwa", "New recovery codes generated"));
    } catch {
      toast.error(t("Imeshindikana", "Could not generate codes"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!status?.factorId) return;
    try {
      await mfaRepo.disable(status.factorId);
      setShowCodes(false);
      refresh();
      toast.success(t("2FA imezimwa", "2FA disabled"));
    } catch {
      toast.error(t("Imeshindikana kuzima 2FA", "Could not disable 2FA"));
    }
  };

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" />{" "}
          {t("Uthibitisho wa hatua mbili (2FA)", "Two-factor authentication (2FA)")}
        </span>
      }
      action={status?.enabled && <Pill tone="success">{t("Imewashwa", "Enabled")}</Pill>}
    >
      {isPending ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {t("Inapakia…", "Loading…")}
        </div>
      ) : showCodes ? (
        /* One-time recovery codes view, right after enable / regenerate. */
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {t(
              "Hifadhi namba hizi mahali salama. Kila moja inaweza kuweka 2FA upya mara moja ukipoteza simu yako. Zinaonyeshwa mara hii moja tu.",
              "Store these codes somewhere safe. Each one can reset 2FA once if you lose your phone. They are shown only this once.",
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-secondary/40 p-3 font-mono text-xs">
            {codes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 text-xs bg-[#1E7C3F] hover:bg-[#14532D] text-white"
              onClick={() => {
                downloadRecoveryCodes(codes, user?.email ?? "");
                setDownloaded(true);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("Pakua namba (.txt)", "Download codes (.txt)")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!downloaded}
              onClick={() => setShowCodes(false)}
            >
              {downloaded
                ? t("Nimezihifadhi", "I have saved them")
                : t("Pakua kwanza", "Download first")}
            </Button>
          </div>
        </div>
      ) : enroll ? (
        /* Enrolment wizard: scan or type the secret, then confirm a code. */
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
            <img
              src={enroll.qrCode}
              alt="2FA QR code"
              className="h-40 w-40 rounded-lg bg-white p-1"
            />
            <div className="text-[11px] text-muted-foreground text-center">
              {t(
                "Skani kwa programu ya uthibitisho, au andika ufunguo huu:",
                "Scan with your authenticator app, or type this key manually:",
              )}
            </div>
            <code className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] break-all select-all">
              {enroll.secret}
            </code>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Namba ya tarakimu 6", "6-digit code")}
            </Label>
            <Input
              value={otp}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="h-10 font-mono tracking-[0.3em]"
              placeholder="000000"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || otp.length !== 6}
              onClick={verify}
              className="h-8 text-xs bg-[#1E7C3F] hover:bg-[#14532D] text-white"
            >
              {busy
                ? t("Inathibitisha…", "Verifying…")
                : t("Thibitisha na uwashe", "Verify & enable")}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void cancel()}>
              {t("Ghairi", "Cancel")}
            </Button>
          </div>
        </div>
      ) : status?.enabled ? (
        /* Enabled state: regenerate codes or turn off. */
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-border p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1E7C3F]/10">
              <Smartphone className="h-5 w-5 text-[#1E7C3F]" />
            </span>
            <div className="flex-1 text-xs text-muted-foreground">
              {t(
                "Kila unapoingia utaombwa namba ya OTP kutoka kwenye programu yako ya uthibitisho.",
                "Every sign-in asks for an OTP code from your authenticator app.",
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={busy}
              onClick={regenerate}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("Namba mpya za uokoaji", "New recovery codes")}
            </Button>
            <ConfirmDialog
              destructive
              title={t("Zima 2FA?", "Disable 2FA?")}
              description={t(
                "Akaunti yako italindwa na nenosiri pekee.",
                "Your account will be protected by the password only.",
              )}
              confirmLabel={t("Zima", "Disable")}
              onConfirm={() => void disable()}
              trigger={
                <Button size="sm" variant="ghost" className="h-8 text-xs text-[#E11B22]">
                  {t("Zima 2FA", "Disable 2FA")}
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        /* Disabled state: offer to enable. */
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
            <Smartphone className="h-5 w-5 text-[#1E7C3F]" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm">
              {t("Programu ya uthibitisho", "Authenticator app")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t(
                "Ongeza hatua ya pili ya usalama: OTP kutoka Google Authenticator, Authy au nyingine.",
                "Add a second security step: an OTP from Google Authenticator, Authy or similar.",
              )}
            </div>
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={start}
            className="h-8 text-xs bg-[#1E7C3F] hover:bg-[#14532D] text-white"
          >
            {busy ? t("Inaanza…", "Starting…") : t("Washa", "Enable")}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function SessionsCard() {
  const { t } = useApp();
  const { data: sessions = [], isPending } = useSessions();
  const revoke = useRevokeSession();
  const signOutOthers = useSignOutOtherDevices();
  const others = sessions.filter((s) => !s.current);

  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-1.5">
          <MonitorSmartphone className="h-4 w-4" /> {t("Vifaa na vikao", "Devices & sessions")}
        </span>
      }
      action={
        others.length > 0 && (
          <ConfirmDialog
            destructive
            title={t("Toa vifaa vingine vyote?", "Sign out all other devices?")}
            description={t(
              "Kila kifaa kingine kitatakiwa kuingia upya.",
              "Every other device will need to sign in again.",
            )}
            confirmLabel={t("Toa vyote", "Sign out all")}
            onConfirm={() =>
              signOutOthers.mutate(undefined, {
                onSuccess: () =>
                  toast.success(t("Vifaa vingine vimetolewa", "Other devices signed out")),
                onError: () => toast.error(t("Imeshindikana", "Could not sign out devices")),
              })
            }
            trigger={
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                {t("Toa vingine vyote", "Sign out others")}
              </Button>
            }
          />
        )
      }
    >
      {isPending ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {t("Inapakia…", "Loading…")}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                <MonitorSmartphone className="h-4 w-4 text-[#1E7C3F]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {deviceLabel(s.userAgent)}{" "}
                  {s.current && <Pill tone="success">{t("Kifaa hiki", "This device")}</Pill>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.ip ? `${s.ip} · ` : ""}
                  {t("Mwisho", "Last active")}: {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              {!s.current && (
                <ConfirmDialog
                  destructive
                  title={t("Toa kifaa hiki?", "Sign out this device?")}
                  description={t(
                    "Kifaa hicho kitatakiwa kuingia upya.",
                    "That device will need to sign in again.",
                  )}
                  confirmLabel={t("Toa", "Sign out")}
                  onConfirm={() =>
                    revoke.mutate(s.id, {
                      onSuccess: () => toast.success(t("Kifaa kimetolewa", "Device signed out")),
                      onError: () => toast.error(t("Imeshindikana", "Could not sign out")),
                    })
                  }
                  trigger={
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-[#E11B22]">
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      {t("Toa", "Sign out")}
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        {t(
          "Kutoa kifaa kunazuia kuendelea kwa kikao chake; kitatoka kabisa ndani ya saa moja.",
          "Revoking stops that device's session from renewing; it is fully signed out within the hour.",
        )}
      </div>
    </SectionCard>
  );
}
