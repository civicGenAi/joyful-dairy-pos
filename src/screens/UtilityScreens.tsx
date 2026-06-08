import { Link, useRouter } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { AlertOctagon, Construction, Lock, Search, ServerCrash, WifiOff } from "lucide-react";
import { useApp } from "@/app/context";
import type { ReactNode } from "react";

function Shell({
  icon,
  code,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  code?: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-5">
          <JoyLogo />
        </div>
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-white mb-5 shadow-elevated"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          {icon}
        </div>
        {code && <div className="font-display text-5xl font-bold brand-gradient-text">{code}</div>}
        <h1 className="font-display text-2xl font-bold mt-2">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{subtitle}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export function NotFoundScreen() {
  const { t } = useApp();
  return (
    <Shell
      code="404"
      icon={<Search className="h-9 w-9" />}
      title={t("Ukurasa haupatikani", "Page not found")}
      subtitle={t(
        "Ukurasa unaoutafuta haupo au umehamishwa. Hebu turudi kwenye njia.",
        "The page you're looking for doesn't exist or has been moved. Let's get you back on track.",
      )}
    >
      <Button
        asChild
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <Link to="/dashboard">{t("Nenda kwenye dashibodi", "Go to dashboard")}</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/status">{t("Tazama hali ya mfumo", "View system status")}</Link>
      </Button>
    </Shell>
  );
}

export function ForbiddenScreen() {
  const { t } = useApp();
  return (
    <Shell
      code="403"
      icon={<Lock className="h-9 w-9" />}
      title={t("Huna ruhusa", "You don't have access")}
      subtitle={t(
        "Jukumu lako haliruhusu ukurasa huu. Muulize Admin akupe ruhusa, au rudi kwenye sehemu unayoweza kutumia.",
        "Your role doesn't permit this screen. Ask an Admin to grant access, or head back to a place you can use.",
      )}
    >
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
      <Button
        asChild
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <Link to="/settings">{t("Omba ruhusa", "Request access")}</Link>
      </Button>
    </Shell>
  );
}

export function ServerErrorScreen() {
  const { t } = useApp();
  const router = useRouter();
  return (
    <Shell
      code="500"
      icon={<ServerCrash className="h-9 w-9" />}
      title={t("Kuna tatizo", "Something went wrong")}
      subtitle={t(
        "Timu yetu imearifiwa. Jaribu tena baada ya muda, au rudi kwenye dashibodi.",
        "Our team has been notified. Try again in a moment, or return to the dashboard.",
      )}
    >
      <Button
        onClick={() => router.invalidate()}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena", "Try again")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
    </Shell>
  );
}

export function MaintenanceScreen() {
  const { t } = useApp();
  return (
    <Shell
      icon={<Construction className="h-9 w-9" />}
      title={t("Tunaboresha mfumo", "We're upgrading the system")}
      subtitle={t(
        "African Joy POS iko kwenye matengenezo mafupi. Tutarudi mtandaoni hivi karibuni. Asante kwa subira.",
        "African Joy POS is under brief maintenance. We'll be back online shortly. Thanks for your patience.",
      )}
    >
      <Button asChild variant="outline">
        <Link to="/status">{t("Tazama hali", "View status")}</Link>
      </Button>
    </Shell>
  );
}

export function OfflineScreen() {
  const { t } = useApp();
  return (
    <Shell
      icon={<WifiOff className="h-9 w-9" />}
      title={t("Huna mtandao", "You're offline")}
      subtitle={t(
        "Mauzo na ukusanyaji unaorekodi kwenye gari la njia vinahifadhiwa kwenye simu na vitasawazishwa moja kwa moja mtandao ukirudi.",
        "Sales and collections you record on the route module are saved on this device and will sync automatically when the connection returns.",
      )}
    >
      <Button
        onClick={() => window.location.reload()}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena muunganisho", "Retry connection")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/van">{t("Endelea bila mtandao", "Continue offline")}</Link>
      </Button>
    </Shell>
  );
}

export function GenericErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useApp();
  return (
    <Shell
      icon={<AlertOctagon className="h-9 w-9" />}
      title={t("Ukurasa huu umekutana na tatizo", "This page hit a snag")}
      subtitle={
        error?.message ||
        t(
          "Hitilafu isiyotarajiwa imetokea wakati wa kuonyesha ukurasa.",
          "An unexpected error occurred while rendering this screen.",
        )
      }
    >
      <Button
        onClick={reset}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena", "Try again")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
    </Shell>
  );
}
