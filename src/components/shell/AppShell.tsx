import { useApp } from "@/app/context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useApp();
  // Persist the collapsed state so opening a new tab keeps the user's choice.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ajd:sidebar-collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ajd:sidebar-collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // Close mobile drawer on resize up to desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!user) return <Navigate to="/" />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} onOpenMobileNav={() => setMobileOpen(true)} />
        <motion.main
          key={title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-7"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
