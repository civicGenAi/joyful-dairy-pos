import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import {
  useDrivers,
  useDriversOverview,
  useDriverStats,
  useDriverCustomers,
  useDriverRoutes,
  useDriverRecentSales,
  useDriverRecentDeposits,
  useCreateDriver,
  useSetDriverPassword,
  useSetDriverActive,
} from "@/lib/data/hooks/drivers";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { useState } from "react";
import { toast } from "sonner";
import {
  IdCard,
  Search,
  Plus,
  Eye,
  KeyRound,
  Ban,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Wallet,
  UserSquare2,
  Route as RouteIcon,
  Wand2,
  Copy,
  Truck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type { User } from "@/mock/types";
import type { DriverOverview } from "@/lib/data/drivers";
import { Link } from "@tanstack/react-router";
import { generateStrongPassword, passwordStrength } from "@/lib/data/profile";
import { StrengthBar } from "@/components/drivers/driver-account";

export function DriversScreen() {
  const { t } = useApp();
  const { data: drivers = [], isPending, isError, refetch } = useDrivers();
  const { data: overview = [] } = useDriversOverview();
  const [q, setQ] = useState("");
  const overviewOf = (id: string) => overview.find((o) => o.profileId === id);

  const filtered = drivers.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      d.phone.toLowerCase().includes(q.toLowerCase()),
  );
  const activeCount = drivers.filter((d) => d.active).length;
  const bannedCount = drivers.length - activeCount;

  if (isPending) {
    return (
      <AppShell title={t("Madereva", "Drivers")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={5} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title={t("Madereva", "Drivers")}>
        <EmptyState
          icon={IdCard}
          title={t("Imeshindikana kupakia madereva", "Could not load drivers")}
          description={t("Tafadhali jaribu tena.", "Please try again.")}
          action={
            <Button onClick={() => refetch()} variant="outline">
              {t("Jaribu tena", "Retry")}
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Madereva", "Drivers")}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard
          label={t("Jumla madereva", "Total drivers")}
          value={num(drivers.length)}
          accent="green"
        />
        <StatCard label={t("Wanaoendesha", "Active")} value={num(activeCount)} accent="info" />
        <StatCard label={t("Wamezuiwa", "Banned")} value={num(bannedCount)} accent="red" />
      </div>

      <SectionCard
        title={t("Orodha ya madereva", "Driver roster")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-52 pl-8 text-xs"
                placeholder={t("Tafuta jina au simu…", "Search name or phone…")}
              />
            </div>
            <AddDriverDialog />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={IdCard}
            title={t("Hakuna madereva wanaolingana", "No matching drivers")}
            description={t(
              "Ongeza dereva mpya au badilisha utafutaji.",
              "Add a new driver or adjust the search.",
            )}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <DriverCard key={d.id} driver={d} overview={overviewOf(d.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}

// ---- Roster card ----------------------------------------------------------

// One driver, at a glance: who they are, whether they are out on the road
// today, and what they have sold. Clicking opens their full page.
function DriverCard({ driver, overview }: { driver: User; overview?: DriverOverview }) {
  const { t } = useApp();
  const initials = driver.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <Link
      to="/drivers/$id"
      params={{ id: driver.id }}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card transition hover:border-[#1E7C3F] hover:shadow-elevated ${
        driver.active ? "" : "opacity-70"
      }`}
    >
      <div
        className="h-16 w-full"
        style={{
          background: `linear-gradient(135deg, ${driver.avatarColor}, ${driver.avatarColor}55)`,
        }}
      />
      <div className="px-4 pb-4">
        <div className="-mt-7 mb-2 flex items-end justify-between gap-2">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl border-4 border-card text-lg font-bold text-white"
            style={{ background: driver.avatarColor }}
          >
            {initials}
          </span>
          {overview?.loadedToday ? (
            <Pill tone="success">
              <Truck className="h-3 w-3" />
              {t("Yupo njiani leo", "Out today")}
            </Pill>
          ) : driver.active ? (
            <Pill tone="slate">{t("Hayupo njiani", "Not out")}</Pill>
          ) : (
            <Pill tone="danger">{t("Amezuiwa", "Banned")}</Pill>
          )}
        </div>

        <div className="font-semibold leading-tight truncate">{driver.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{driver.phone}</div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Leo", "Today")}
            </div>
            <div className="font-num font-bold text-sm">{tzs(overview?.salesTodayTZS ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Mwezi huu", "This month")}
            </div>
            <div className="font-num font-bold text-sm">{tzs(overview?.salesMonthTZS ?? 0)}</div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {t("Mauzo ya mwisho", "Last sale")}: {overview?.lastSaleDate ?? "–"}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#1E7C3F] opacity-0 transition group-hover:opacity-100">
            {t("Fungua", "Open")}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---- Add driver -------------------------------------------------------

function AddDriverDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const create = useCreateDriver();

  const generate = () => {
    const pwd = generateStrongPassword();
    setPassword(pwd);
    setShow(true);
  };

  const save = () => {
    if (!name.trim() || !email.trim()) return;
    if (passwordStrength(password) < 4) {
      toast.error(
        t(
          "Nenosiri liwe imara: herufi 8+, kubwa na ndogo, namba na alama",
          "Password must be strong: 8+ chars with upper, lower, number and symbol",
        ),
      );
      return;
    }
    create.mutate(
      { name, email, phone, password },
      {
        onSuccess: () => {
          toast.success(t("Dereva ameongezwa", "Driver added"));
          setOpen(false);
          setName("");
          setEmail("");
          setPhone("");
          setPassword("");
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add driver")),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Dereva mpya", "Add driver")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Sajili dereva mpya", "Register a new driver")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Jina kamili", "Full name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Simu", "Phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 7xx xxx xxx"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Barua pepe", "Email")}</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dereva@africanjoy.co.tz"
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("Nenosiri la kuanzia", "Initial password")}</Label>
              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E7C3F] hover:underline"
              >
                <Wand2 className="h-3 w-3" />
                {t("Tengeneza imara", "Generate strong")}
              </button>
            </div>
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <StrengthBar password={password} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={create.isPending}>
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---- Reset password -----------------------------------------------------
