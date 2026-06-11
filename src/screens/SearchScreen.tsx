import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data hooks; nav is capability-driven.
import { navGroupsFor } from "@/lib/nav";
import { useCustomers } from "@/lib/data/hooks/customers";
import { useFarmers } from "@/lib/data/hooks/farmers";
import { useProducts } from "@/lib/data/hooks/products";
import { SectionCard, Pill } from "@/components/ui/data-bits";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search as SearchIcon, User as UserIcon, Tractor, Package, MapPin } from "lucide-react";
import * as Icons from "lucide-react";

export function SearchScreen() {
  const { t, lang, can } = useApp();
  const nav = useNavigate();
  const search = useSearch({ from: "/search" }) as { q?: string };
  const [q, setQ] = useState(search.q ?? "");
  // Search UIs tolerate missing read capability: errors render as empty lists.
  const customers = useCustomers().data ?? [];
  const farmers = useFarmers().data ?? [];
  const products = useProducts().data ?? [];

  // Keep URL in sync as user types (debounced via simple short timer)
  useEffect(() => {
    const id = setTimeout(() => {
      nav({ to: "/search", search: q ? { q } : {}, replace: true });
    }, 200);
    return () => clearTimeout(id);
  }, [q, nav]);

  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => navGroupsFor(can), [can]);

  const results = useMemo(() => {
    if (!needle) return null;
    return {
      customers: customers.filter((c) => c.name.toLowerCase().includes(needle)),
      farmers: farmers.filter(
        (f) => f.name.toLowerCase().includes(needle) || f.village.toLowerCase().includes(needle),
      ),
      products: products.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.swName.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle),
      ),
      modules: groups.flatMap((g) =>
        g.items
          .filter(
            (it) => it.label.toLowerCase().includes(needle) || it.sw.toLowerCase().includes(needle),
          )
          .map((it) => ({ ...it, group: g.group, groupSw: g.sw })),
      ),
    };
  }, [needle, groups, customers, farmers, products]);

  const totalCount = results
    ? results.customers.length +
      results.farmers.length +
      results.products.length +
      results.modules.length
    : 0;

  return (
    <AppShell title={t("Tafuta", "Search")}>
      <div className="rounded-2xl bg-card border border-border shadow-card p-4 sm:p-6 mb-5">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 pl-12 text-base"
            placeholder={t(
              "Tafuta wateja, wafugaji, bidhaa, moduli…",
              "Search customers, farmers, products, modules…",
            )}
            autoFocus
          />
        </div>
        {needle && (
          <div className="mt-2 text-xs text-muted-foreground">
            {totalCount} {t("matokeo kwa", "results for")} <strong>{q}</strong>
          </div>
        )}
      </div>

      {!needle ? (
        <EmptyState
          icon={SearchIcon}
          title={t("Anza kuandika kutafuta", "Start typing to search")}
          description={t(
            "Tafuta kwenye wateja, wafugaji, bidhaa, na moduli za mfumo.",
            "Search across customers, farmers, products, and system modules.",
          )}
        />
      ) : totalCount === 0 ? (
        <EmptyState
          title={t("Hakuna matokeo", "No matches")}
          description={t(
            "Jaribu neno lingine, hakikisha kuandika kwa usahihi.",
            "Try a different term or check the spelling.",
          )}
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          {results!.modules.length > 0 && (
            <SectionCard
              className="lg:col-span-2"
              title={t("Moduli", "Modules")}
              action={<Pill tone="info">{results!.modules.length}</Pill>}
            >
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {results!.modules.map((m) => {
                  const Icon =
                    (Icons as unknown as Record<string, typeof Icons.Circle>)[m.icon] ??
                    Icons.ArrowRight;
                  return (
                    <li key={m.to}>
                      <Link
                        to={m.to}
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-[#2F9E44] hover:shadow-card transition"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-lg text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {lang === "sw" ? m.sw : m.label}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {lang === "sw" ? m.groupSw : m.group}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {results!.customers.length > 0 && (
            <SectionCard
              title={t("Wateja", "Customers")}
              action={<Pill tone="info">{results!.customers.length}</Pill>}
            >
              <ul className="divide-y divide-border">
                {results!.customers.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/customers"
                      className="flex items-center gap-3 py-2.5 hover:bg-accent/40 -mx-3 px-3 rounded-lg"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                        <UserIcon className="h-4 w-4 text-[#1E7C3F]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      </div>
                      <Pill
                        tone={
                          c.type === "cash" ? "info" : c.type === "credit" ? "warning" : "success"
                        }
                      >
                        {c.type}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {results!.farmers.length > 0 && (
            <SectionCard
              title={t("Wafugaji", "Farmers")}
              action={<Pill tone="info">{results!.farmers.length}</Pill>}
            >
              <ul className="divide-y divide-border">
                {results!.farmers.slice(0, 12).map((f) => (
                  <li key={f.id}>
                    <Link
                      to="/farmers"
                      className="flex items-center gap-3 py-2.5 hover:bg-accent/40 -mx-3 px-3 rounded-lg"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                        <Tractor className="h-4 w-4 text-[#1E7C3F]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {f.village}
                        </div>
                      </div>
                      <Pill
                        tone={
                          f.status === "delayed"
                            ? "danger"
                            : f.status === "due"
                              ? "warning"
                              : "success"
                        }
                      >
                        {f.status}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {results!.products.length > 0 && (
            <SectionCard
              className="lg:col-span-2"
              title={t("Bidhaa", "Products")}
              action={<Pill tone="info">{results!.products.length}</Pill>}
            >
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {results!.products.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/products"
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-[#2F9E44] transition"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                        <Package className="h-4 w-4 text-[#1E7C3F]" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.swName}</div>
                      </div>
                      <Pill tone="info">{p.category}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
}
