import { useApp } from "@/app/context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/" />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} />
        <motion.main
          key={title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex-1 px-4 lg:px-6 py-5 lg:py-7"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
