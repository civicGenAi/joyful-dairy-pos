import { useApp } from "@/app/context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useLocalStorage, usePrefersReducedMotion } from "@/hooks/use-local-storage";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, authReady, t } = useApp();
  // Persist the collapsed state so opening a new tab keeps the user's choice.
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("ajd:sidebar-collapsed", false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Close mobile drawer on resize up to desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Wait for the persisted session check so a refresh doesn't bounce to login.
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <span
          className="h-8 w-8 rounded-full border-4 border-[#1E7C3F] border-t-transparent animate-spin"
          role="status"
          aria-label={t("Inapakia", "Loading")}
        />
      </div>
    );
  }
  if (!user) return <Navigate to="/" />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Skip-link for keyboard users, visible only on focus */}
      <a
        href="#ajd-main"
        className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 rounded-lg bg-foreground text-background px-3 py-2 text-sm font-semibold shadow-elevated"
      >
        {t("Ruka kwenye yaliyomo", "Skip to main content")}
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} onOpenMobileNav={() => setMobileOpen(true)} />
        <motion.main
          id="ajd-main"
          key={title}
          tabIndex={-1}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
          className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-7 focus:outline-none"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
