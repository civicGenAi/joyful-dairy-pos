import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import {
  useDrivers,
  useDriverStats,
  useDriverCustomers,
  useDriverRoutes,
  useDriverRecentSales,
  useDriverRecentDeposits,
  useDriverDailySales,
  useSetDriverActive,
} from "@/lib/data/hooks/drivers";
import { ResetDriverPasswordDialog } from "@/components/drivers/driver-account";
import { useParams, Link } from "@tanstack/react-router";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { tzs, num } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Wallet,
  UserSquare2,
  Route as RouteIcon,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

// One driver's own dashboard: who they are, what they have moved, where
// they go, who they sell to and what they have banked, on a full page
// instead of squeezed into a drawer.
export function DriverDetailScreen() {
  const { t, lang } = useApp();
  const { id } = useParams({ from: "/drivers/$id" });
  const { data: drivers = [], isPending } = useDrivers();
  const driver = drivers.find((d) => d.id === id);
  const { data: stats } = useDriverStats(id);
  const { data: daily = [] } = useDriverDailySales(id, 14);
  const { data: customers = [] } = useDriverCustomers(id);
  const { data: routes = [] } = useDriverRoutes(id);
  const { data: sales = [] } = useDriverRecentSales(id);
  const { data: deposits = [] } = useDriverRecentDeposits(id);
  const setActive = useSetDriverActive();

  if (isPending) {
    return (
      <AppShell title={t("Dereva", "Driver")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={4} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (!driver) {
    return (
      <AppShell title={t("Dereva", "Driver")}>
        <EmptyState title={t("Dereva hajapatikana", "Driver not found")} />
      </AppShell>
    );
  }

  const initials = driver.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const chart = daily.map((d) => ({ day: d.date.slice(5), value: d.amountTZS }));
  // Money still in the driver's hands: everything sold on the route, less
  // everything banked. Credit sales are excluded, they were never cash.
  const banked = stats?.depositsTotalTZS ?? 0;

  return (
    <AppShell title={driver.name}>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/drivers">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t("Rudi kwa madereva", "Back to drivers")}
        </Link>
      </Button>

      {/* Identity + account actions */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-5">
        <div
          className="h-20 w-full"
          style={{
            background: `linear-gradient(135deg, ${driver.avatarColor}, ${driver.avatarColor}55)`,
          }}
        />
        <div className="px-4 pb-4">
          <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-card text-xl font-bold text-white"
                style={{ background: driver.avatarColor }}
              >
                {initials}
              </span>
              <div className="pb-1">
                <div className="text-lg font-bold font-display leading-tight">{driver.name}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {driver.phone || "–"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {driver.email}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {driver.active ? (
                <Pill tone="success">{t("Anaendesha", "Active")}</Pill>
              ) : (
                <Pill tone="danger">{t("Amezuiwa", "Banned")}</Pill>
              )}
              <ResetDriverPasswordDialog driver={driver} />
              <ConfirmDialog
                destructive={driver.active}
                title={
                  driver.active
                    ? t("Zuia dereva?", "Ban this driver?")
                    : t("Ondoa zuio?", "Unban this driver?")
                }
                description={
                  driver.active
                    ? t(
                        "Hataweza kuingia mfumoni tena mpaka atakapoondolewa zuio.",
                        "They will not be able to sign in again until unbanned.",
                      )
                    : t("Ataweza kuingia mfumoni tena.", "They will be able to sign in again.")
                }
                confirmLabel={driver.active ? t("Zuia", "Ban") : t("Ondoa zuio", "Unban")}
                onConfirm={() =>
                  setActive.mutate(
                    { id: driver.id, active: !driver.active },
                    {
                      onSuccess: () =>
                        toast.success(
                          driver.active
                            ? t("Dereva amezuiwa", "Driver banned")
                            : t("Zuio limeondolewa", "Driver unbanned"),
                        ),
                      onError: () => toast.error(t("Imeshindikana", "Could not update")),
                    },
                  )
                }
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs ${driver.active ? "text-[#E11B22]" : "text-[#1E7C3F]"}`}
                  >
                    {driver.active ? (
                      <>
                        <Ban className="h-3.5 w-3.5 mr-1.5" /> {t("Zuia", "Ban")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> {t("Ondoa zuio", "Unban")}
                      </>
                    )}
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Mauzo mwezi huu", "Sales this month")}
          value={tzs(stats?.salesThisMonthTZS ?? 0)}
          accent="green"
        />
        <StatCard
          label={t("Mauzo yote", "Sales all-time")}
          value={tzs(stats?.salesTotalTZS ?? 0)}
          sub={`${num(stats?.salesCount ?? 0)} ${t("risiti", "receipts")}`}
          accent="info"
        />
        <StatCard
          label={t("Amana alizoweka benki", "Banked by this driver")}
          value={tzs(banked)}
          sub={`${num(stats?.depositsCount ?? 0)} ${t("amana", "deposits")}`}
          accent="amber"
        />
        <StatCard
          label={t("Wateja aliohudumia", "Customers served")}
          value={num(stats?.distinctCustomers ?? 0)}
          sub={`${num(stats?.distinctRoutes ?? 0)} ${t("njia", "routes")}`}
          accent="green"
        />
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4" />
            {t("Mauzo ya siku 14", "Sales, last 14 days")}
          </span>
        }
        className="mb-4"
      >
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={chart} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="driverSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F9E44" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2F9E44" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E6EBE1" vertical={false} />
              <XAxis dataKey="day" stroke="#6B776E" fontSize={11} />
              <YAxis
                stroke="#6B776E"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: number) => tzs(v)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1E7C3F"
                strokeWidth={2}
                fill="url(#driverSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("Njia alizoanzia", "Routes worked")}
            </span>
          }
        >
          {routes.length === 0 ? (
            <EmptyState title={t("Hakuna upakiaji bado", "No loads recorded yet")} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {routes.map((r) => (
                <li key={r.locationId} className="flex items-center gap-3 py-2.5">
                  <MapPin className="h-3.5 w-3.5 text-[#1E7C3F] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{lang === "sw" ? r.swName : r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.loadsCount} {t("mizigo", "loads")} · {t("mwisho", "last")} {r.lastLoadDate}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <UserSquare2 className="h-4 w-4" />
              {t("Wateja wake", "Their customers")}
            </span>
          }
        >
          {customers.length === 0 ? (
            <EmptyState title={t("Hakuna mauzo bado", "No sales recorded yet")} />
          ) : (
            <ul className="divide-y divide-border text-sm max-h-72 overflow-y-auto">
              {customers.map((c) => (
                <li key={c.customerId} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.salesCount} {t("mauzo", "sales")} · {c.lastSaleDate}
                    </div>
                  </div>
                  <div className="font-num font-semibold shrink-0">{tzs(c.totalTZS)}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {t("Mauzo ya hivi karibuni", "Recent sales")}
            </span>
          }
        >
          {sales.length === 0 ? (
            <EmptyState title={t("Hakuna mauzo bado", "No sales yet")} />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-num text-xs text-muted-foreground">{s.date}</td>
                    <td className="py-2 truncate">{s.customerName ?? t("Bila jina", "Walk-in")}</td>
                    <td className="py-2 capitalize text-xs">{s.payment}</td>
                    <td className="py-2 text-right font-num font-semibold">{tzs(s.totalTZS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("Amana za hivi karibuni", "Recent deposits")}
            </span>
          }
        >
          {deposits.length === 0 ? (
            <EmptyState title={t("Hakuna amana bado", "Nothing banked yet")} />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-num text-xs text-muted-foreground">{d.date}</td>
                    <td className="py-2 font-num text-xs">{d.ref ?? d.id}</td>
                    <td className="py-2 capitalize text-xs">{d.method}</td>
                    <td className="py-2 text-right font-num font-semibold">{tzs(d.amountTZS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
