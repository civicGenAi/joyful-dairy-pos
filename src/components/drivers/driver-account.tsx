import { useApp } from "@/app/context";
import { useSetDriverPassword } from "@/lib/data/hooks/drivers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { KeyRound, Wand2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { User } from "@/mock/types";
import { generateStrongPassword, passwordStrength } from "@/lib/data/profile";

// Shared by the roster's "add driver" form and the driver page's password
// reset, so the strength rules can never disagree between the two.
const STRENGTH_META = [
  { sw: "Dhaifu sana", en: "Very weak", color: "#E11B22", width: "10%" },
  { sw: "Dhaifu", en: "Weak", color: "#E11B22", width: "30%" },
  { sw: "Wastani", en: "Fair", color: "#E5A100", width: "55%" },
  { sw: "Nzuri", en: "Good", color: "#E5A100", width: "80%" },
  { sw: "Imara", en: "Strong", color: "#2F9E44", width: "100%" },
];

export function StrengthBar({ password }: { password: string }) {
  const { t, lang } = useApp();
  const score = passwordStrength(password);
  const meta = STRENGTH_META[score];
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: password ? meta.width : "0%", background: meta.color }}
        />
      </div>
      {password && (
        <div className="text-[11px] font-semibold" style={{ color: meta.color }}>
          {lang === "sw" ? meta.sw : meta.en}
        </div>
      )}
      {!password && (
        <div className="text-[11px] text-muted-foreground">
          {t("8+ herufi, kubwa/ndogo, namba, alama", "8+ chars, upper/lower, number, symbol")}
        </div>
      )}
    </div>
  );
}

export function ResetDriverPasswordDialog({ driver }: { driver: User }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const setPwd = useSetDriverPassword();

  const generate = () => {
    const pwd = generateStrongPassword();
    setPassword(pwd);
    setShow(true);
  };

  const copy = () => {
    void navigator.clipboard.writeText(password);
    toast.success(t("Nenosiri limenakiliwa", "Password copied"));
  };

  const save = () => {
    if (passwordStrength(password) < 4) {
      toast.error(
        t(
          "Nenosiri liwe imara: herufi 8+, kubwa na ndogo, namba na alama",
          "Password must be strong: 8+ chars with upper, lower, number and symbol",
        ),
      );
      return;
    }
    setPwd.mutate(
      { id: driver.id, password },
      {
        onSuccess: () => {
          toast.success(t("Nenosiri limerekebishwa", "Password reset"));
          setPassword("");
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kurekebisha", "Could not reset the password")),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <KeyRound className="h-3.5 w-3.5 mr-1.5" />
          {t("Rekebisha nenosiri", "Reset password")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>
            {t(`Rekebisha nenosiri la ${driver.name}`, `Reset password for ${driver.name}`)}
          </SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Tengeneza nenosiri jipya kisha umpe dereva moja kwa moja, siyo kwa ujumbe.",
              "Generate a new password and hand it to the driver directly, not over message.",
            )}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              {password && (
                <button
                  type="button"
                  onClick={copy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-accent text-muted-foreground"
                  title={t("Nakili", "Copy")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <StrengthBar password={password} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={setPwd.isPending || !password}>
            {setPwd.isPending ? t("Inahifadhi…", "Saving…") : t("Weka nenosiri", "Set password")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
