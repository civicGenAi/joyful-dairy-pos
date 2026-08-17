import { useApp } from "@/app/context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateOwnProfile, useChangeOwnPassword } from "@/lib/data/hooks/profile";
import { generateStrongPassword, passwordStrength } from "@/lib/data/profile";
import { useState } from "react";
import { toast } from "sonner";
import { UserCircle2, KeyRound, Eye, EyeOff, Wand2 } from "lucide-react";

// A driver's own account panel, reachable from the van header. Same
// underlying update_own_profile / change-password tools as the desktop
// /profile page, but never leaves the driver's working screen: dropping
// them into the full sidebar-based desktop layout mid-route would be
// disorienting on a phone.

const STRENGTH_META = [
  { sw: "Dhaifu sana", en: "Very weak", color: "#E11B22", width: "10%" },
  { sw: "Dhaifu", en: "Weak", color: "#E11B22", width: "30%" },
  { sw: "Wastani", en: "Fair", color: "#E5A100", width: "55%" },
  { sw: "Nzuri", en: "Good", color: "#E5A100", width: "80%" },
  { sw: "Imara", en: "Strong", color: "#2F9E44", width: "100%" },
];

export function DriverAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, user } = useApp();
  const updateProfile = useUpdateOwnProfile();
  const changePassword = useChangeOwnPassword();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const score = passwordStrength(newPwd);
  const meta = STRENGTH_META[score];

  const saveProfile = () => {
    if (!name.trim()) return;
    updateProfile.mutate(
      { name, phone },
      {
        onSuccess: () => toast.success(t("Jina limehifadhiwa", "Name saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save")),
      },
    );
  };

  const generate = () => {
    const pwd = generateStrongPassword();
    setNewPwd(pwd);
    setConfirm(pwd);
    setShow(true);
    toast(t("Nakili nenosiri kabla ya kuhifadhi", "Copy the password before saving"));
  };

  const savePassword = () => {
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
    changePassword.mutate(
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

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2.5 text-lg">
            <span
              className="grid h-10 w-10 place-items-center rounded-full text-white font-bold"
              style={{ background: user.avatarColor }}
            >
              {user.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            {t("Akaunti yangu", "My account")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <UserCircle2 className="h-3.5 w-3.5" /> {t("Jina na simu", "Name and phone")}
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 text-base"
            placeholder={t("Jina kamili", "Full name")}
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
            placeholder="+255 7xx xxx xxx"
          />
          <Button
            onClick={saveProfile}
            disabled={updateProfile.isPending}
            className="h-12 w-full text-white font-bold"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {updateProfile.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi jina", "Save name")}
          </Button>
        </div>

        <div className="mt-6 space-y-2 border-t border-border pt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> {t("Badilisha nenosiri", "Change password")}
          </div>
          <Input
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            placeholder={t("Nenosiri la zamani", "Old password")}
            className="h-12 text-base"
          />
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs">{t("Nenosiri jipya", "New password")}</Label>
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#1E7C3F]"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {t("Tengeneza imara", "Generate strong")}
            </button>
          </div>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="h-12 pr-12 text-base"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: newPwd ? meta.width : "0%", background: meta.color }}
              />
            </div>
            {newPwd && (
              <div className="text-xs font-bold" style={{ color: meta.color }}>
                {lang === "sw" ? meta.sw : meta.en}
              </div>
            )}
          </div>
          <Input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("Rudia nenosiri jipya", "Confirm new password")}
            className="h-12 text-base"
          />
          <Button
            onClick={savePassword}
            disabled={changePassword.isPending || !oldPwd || !newPwd}
            className="h-12 w-full text-white font-bold"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {changePassword.isPending
              ? t("Inabadilisha…", "Changing…")
              : t("Badilisha nenosiri", "Change password")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
