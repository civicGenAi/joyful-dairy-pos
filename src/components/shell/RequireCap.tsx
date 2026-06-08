import { useApp } from "@/app/context";
import { Navigate } from "@tanstack/react-router";
import type { Capability } from "@/lib/auth";
import type { ReactNode } from "react";

/**
 * Route-level capability guard. Wraps a screen and bounces the user to /403 if
 * they lack the required capability. Uses the user's REAL roles, not the
 * "view as" override, so an admin previewing as `route` can still see admin
 * screens by typing the URL.
 */
export function RequireCap({ cap, children }: { cap: Capability | Capability[]; children: ReactNode }) {
  const { user, can } = useApp();
  if (!user) return <Navigate to="/" />;
  const needed = Array.isArray(cap) ? cap : [cap];
  if (!needed.some((c) => can(c))) return <Navigate to="/403" />;
  return <>{children}</>;
}
