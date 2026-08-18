import type { Capability } from "@/lib/auth";

// Capability-driven navigation: a user sees exactly the tabs their
// capabilities allow. The more privileges the admin grants, the more
// tabs appear; no role presets, no "view as".
export interface NavItem {
  to: string;
  label: string;
  sw: string;
  icon: string;
  cap: Capability;
}

export interface NavGroup {
  group: string;
  sw: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    sw: "Muhtasari",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        sw: "Dashibodi",
        icon: "LayoutDashboard",
        cap: "view:dashboard",
      },
    ],
  },
  {
    group: "Procurement",
    sw: "Ununuzi",
    items: [
      { to: "/farmers", label: "Farmers", sw: "Wafugaji", icon: "Users", cap: "farmers:read" },
      {
        to: "/collection-points",
        label: "Collection points",
        sw: "Pointi za ukusanyaji",
        icon: "MapPin",
        cap: "collection:read",
      },
    ],
  },
  {
    group: "Sales",
    sw: "Mauzo",
    items: [
      { to: "/pos", label: "Counter POS", sw: "Mauzo Kaunta", icon: "Receipt", cap: "pos:use" },
      { to: "/van", label: "Route module", sw: "Njia", icon: "Truck", cap: "route:use" },
      {
        to: "/customers",
        label: "Customers",
        sw: "Wateja",
        icon: "UserSquare2",
        cap: "customers:read",
      },
      { to: "/drivers", label: "Drivers", sw: "Madereva", icon: "IdCard", cap: "users:read" },
    ],
  },
  {
    group: "Operations",
    sw: "Uendeshaji",
    items: [
      {
        to: "/production",
        label: "Production",
        sw: "Uzalishaji",
        icon: "Factory",
        cap: "production:read",
      },
      { to: "/stock", label: "Stock & store", sw: "Ghala", icon: "Boxes", cap: "stock:read" },
      {
        to: "/stock-count",
        label: "Morning count",
        sw: "Hesabu ya asubuhi",
        icon: "ListChecks",
        cap: "stock:read",
      },
      {
        to: "/reconciliation",
        label: "Day reconciliation",
        sw: "Funga siku",
        icon: "ClipboardCheck",
        cap: "reconciliation:read",
      },
    ],
  },
  {
    group: "Finance",
    sw: "Fedha",
    items: [
      { to: "/finance", label: "Finance", sw: "Fedha", icon: "Wallet", cap: "finance:read" },
      { to: "/expenses", label: "Expenses", sw: "Matumizi", icon: "Receipt", cap: "finance:read" },
    ],
  },
  {
    group: "Insights",
    sw: "Ripoti",
    items: [
      { to: "/reports", label: "Reports", sw: "Ripoti", icon: "BarChart3", cap: "view:reports" },
      {
        to: "/customer-feedback",
        label: "Customer feedback",
        sw: "Maoni ya wateja",
        icon: "Star",
        cap: "view:reports",
      },
      {
        to: "/products",
        label: "Products & pricing",
        sw: "Bidhaa",
        icon: "Tag",
        cap: "products:read",
      },
    ],
  },
  {
    group: "System",
    sw: "Mfumo",
    items: [
      {
        to: "/settings",
        label: "Settings",
        sw: "Mipangilio",
        icon: "Settings",
        cap: "settings:write",
      },
    ],
  },
];

/** Groups filtered down to the items the holder of `caps` may see. */
export function navGroupsFor(can: (c: Capability) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => can(it.cap)) })).filter(
    (g) => g.items.length > 0,
  );
}
