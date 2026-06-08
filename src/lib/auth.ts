import type { Role } from "@/mock/types";

// Capabilities — single source of truth for what a role can do.
// A user holding multiple roles gets the union of all listed capabilities.
export type Capability =
  | "view:dashboard"
  | "view:reports"
  | "view:status"
  // Procurement
  | "farmers:read"
  | "farmers:write"
  | "collection:read"
  | "collection:write"
  | "transfer:write"
  // Sales
  | "pos:use"
  | "route:use"
  | "customers:read"
  | "customers:write"
  | "deposit:write"
  // Operations
  | "production:read"
  | "production:write"
  | "stock:read"
  | "stock:write"
  | "reconciliation:read"
  | "day:lock"
  // Finance
  | "finance:read"
  | "finance:write"
  | "payout:write"
  | "dayclose:confirm"
  // Catalogue
  | "products:read"
  | "products:write"
  | "prices:write"
  // Admin
  | "users:read"
  | "users:write"
  | "settings:write";

const ROLE_CAPS: Record<Role, Capability[]> = {
  admin: [
    "view:dashboard",
    "view:reports",
    "view:status",
    "farmers:read",
    "farmers:write",
    "collection:read",
    "collection:write",
    "transfer:write",
    "pos:use",
    "route:use",
    "customers:read",
    "customers:write",
    "deposit:write",
    "production:read",
    "production:write",
    "stock:read",
    "stock:write",
    "reconciliation:read",
    "day:lock",
    "finance:read",
    "finance:write",
    "payout:write",
    "dayclose:confirm",
    "products:read",
    "products:write",
    "prices:write",
    "users:read",
    "users:write",
    "settings:write",
  ],
  finance: [
    "view:dashboard",
    "view:reports",
    "customers:read",
    "customers:write",
    "deposit:write",
    "farmers:read",
    "reconciliation:read",
    "dayclose:confirm",
    "finance:read",
    "finance:write",
    "payout:write",
  ],
  production: [
    "view:dashboard",
    "view:reports",
    "production:read",
    "production:write",
    "stock:read",
    "stock:write",
    "collection:read",
    "reconciliation:read",
    "day:lock",
  ],
  sales: ["pos:use", "customers:read", "customers:write", "stock:read", "products:read"],
  route: ["route:use", "customers:read"],
  store: ["stock:read", "stock:write"],
  viewer: ["view:dashboard", "view:reports"],
};

export function capabilitiesFor(roles: Role[]): Set<Capability> {
  const set = new Set<Capability>();
  for (const r of roles) for (const c of ROLE_CAPS[r] ?? []) set.add(c);
  return set;
}

export function hasCap(roles: Role[], cap: Capability): boolean {
  return roles.some((r) => ROLE_CAPS[r]?.includes(cap));
}
