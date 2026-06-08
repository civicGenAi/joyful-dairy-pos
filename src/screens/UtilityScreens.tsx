import { Link, useRouter } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { AlertOctagon, Construction, Lock, Search, ServerCrash, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

function Shell({ icon, code, title, subtitle, children }: { icon: ReactNode; code?: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-5"><JoyLogo /></div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-white mb-5 shadow-elevated" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
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
  return (
    <Shell
      code="404"
      icon={<Search className="h-9 w-9" />}
      title="Page not found"
      subtitle="The page you’re looking for doesn’t exist or has been moved. Let’s get you back on track."
    >
      <Button asChild className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
        <Link to="/dashboard">Go to dashboard</Link>
      </Button>
      <Button asChild variant="outline"><Link to="/status">View system status</Link></Button>
    </Shell>
  );
}

export function ForbiddenScreen() {
  return (
    <Shell
      code="403"
      icon={<Lock className="h-9 w-9" />}
      title="You don’t have access"
      subtitle="Your role doesn’t permit this screen. Ask an Admin or Owner to grant access, or head back to a place you can use."
    >
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
      <Button asChild className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
        <Link to="/settings">Request access</Link>
      </Button>
    </Shell>
  );
}

export function ServerErrorScreen() {
  const router = useRouter();
  return (
    <Shell
      code="500"
      icon={<ServerCrash className="h-9 w-9" />}
      title="Something went wrong"
      subtitle="Our team has been notified. Try again in a moment, or return to the dashboard."
    >
      <Button onClick={() => router.invalidate()} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>Try again</Button>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </Shell>
  );
}

export function MaintenanceScreen() {
  return (
    <Shell
      icon={<Construction className="h-9 w-9" />}
      title="We’re upgrading the system"
      subtitle="African Joy POS is under brief maintenance. We’ll be back online shortly. Thanks for your patience."
    >
      <Button asChild variant="outline"><Link to="/status">View status</Link></Button>
    </Shell>
  );
}

export function OfflineScreen() {
  return (
    <Shell
      icon={<WifiOff className="h-9 w-9" />}
      title="You’re offline"
      subtitle="Sales and collections you record on the route module are saved on this device and will sync automatically when the connection returns."
    >
      <Button onClick={() => window.location.reload()} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>Retry connection</Button>
      <Button asChild variant="outline"><Link to="/van">Continue offline</Link></Button>
    </Shell>
  );
}

export function GenericErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Shell
      icon={<AlertOctagon className="h-9 w-9" />}
      title="This page hit a snag"
      subtitle={error?.message || "An unexpected error occurred while rendering this screen."}
    >
      <Button onClick={reset} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>Try again</Button>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </Shell>
  );
}
