import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import {
  useDrivers,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
} from "lucide-react";
import type { User } from "@/mock/types";
import { generateStrongPassword, passwordStrength } from "@/lib/data/profile";

const STRENGTH_META = [
  { sw: "Dhaifu sana", en: "Very weak", color: "#E11B22", width: "10%" },
  { sw: "Dhaifu", en: "Weak", color: "#E11B22", width: "30%" },
  { sw: "Wastani", en: "Fair", color: "#E5A100", width: "55%" },
  { sw: "Nzuri", en: "Good", color: "#E5A100", width: "80%" },
  { sw: "Imara", en: "Strong", color: "#2F9E44", width: "100%" },
];

function StrengthBar({ password }: { password: string }) {
  const { t, lang } = useApp();
  const score = passwordStrength(password);
  const meta = STRENGTH_META[score];
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: password ? meta.width : "0%", background: meta.color }}
        />
      </div>
      {password && (
        <div className="text-[11px] font-semibold" style={{ color: meta.color }}>
          {lang === "sw" ? meta.sw : meta.en}
        </div>
      )}
      {!password && (
        <div className="text-[11px] text-muted-foreground">
          {t("8+ herufi, kubwa/ndogo, namba, alama", "8+ chars, upper/lower, number, symbol")}
        </div>
      )}
    </div>
  );
}

export function DriversScreen() {
  const { t } = useApp();
  const { data: drivers = [], isPending, isError, refetch } = useDrivers();
  const [q, setQ] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Dereva", "Driver")}</th>
                  <th>{t("Mawasiliano", "Contact")}</th>
                  <th>{t("Hali", "Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-b border-border last:border-0 ${!d.active ? "opacity-60" : ""}`}
                  >
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => setViewingId(d.id)}
                        className="flex items-center gap-2.5 text-left hover:underline"
                      >
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: d.avatarColor }}
                        >
                          {d.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="font-medium">{d.name}</span>
                      </button>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      <div>{d.phone}</div>
                      <div>{d.email}</div>
                    </td>
                    <td className="py-2.5">
                      {d.active ? (
                        <Pill tone="success">{t("Anaendesha", "Active")}</Pill>
                      ) : (
                        <Pill tone="danger">{t("Amezuiwa", "Banned")}</Pill>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setViewingId(d.id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {t("Wasifu kamili", "Full profile")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {viewingId && (
        <DriverProfileDrawer
          driver={drivers.find((d) => d.id === viewingId)!}
          onClose={() => setViewingId(null)}
        />
      )}
    </AppShell>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Dereva mpya", "Add driver")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Sajili dereva mpya", "Register a new driver")}</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={create.isPending}>
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Reset password -----------------------------------------------------

function ResetDriverPasswordDialog({ driver }: { driver: User }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const setPwd = useSetDriverPassword();

  const generate = () => {
    const pwd = generateStrongPassword();
    setPassword(pwd);
    setShow(true);
  };

  const copy = () => {
    void navigator.clipboard.writeText(password);
    toast.success(t("Nenosiri limenakiliwa", "Password copied"));
  };

  const save = () => {
    if (passwordStrength(password) < 4) {
      toast.error(
        t(
          "Nenosiri liwe imara: herufi 8+, kubwa na ndogo, namba na alama",
          "Password must be strong: 8+ chars with upper, lower, number and symbol",
        ),
      );
      return;
    }
    setPwd.mutate(
      { id: driver.id, password },
      {
        onSuccess: () => {
          toast.success(t("Nenosiri limerekebishwa", "Password reset"));
          setPassword("");
          setOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kurekebisha", "Could not reset the password")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <KeyRound className="h-3.5 w-3.5 mr-1.5" />
          {t("Rekebisha nenosiri", "Reset password")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(`Rekebisha nenosiri la ${driver.name}`, `Reset password for ${driver.name}`)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Tengeneza nenosiri jipya kisha umpe dereva moja kwa moja, siyo kwa ujumbe.",
              "Generate a new password and hand it to the driver directly, not over message.",
            )}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("Nenosiri jipya", "New password")}</Label>
              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E7C3F] hover:underline"
              >
                <Wand2 className="h-3 w-3" />
                {t("Tengeneza imara", "Generate strong")}
              </button>
            </div>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              {password && (
                <button
                  type="button"
                  onClick={copy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-accent text-muted-foreground"
                  title={t("Nakili", "Copy")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <StrengthBar password={password} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={setPwd.isPending || !password}>
            {setPwd.isPending ? t("Inahifadhi…", "Saving…") : t("Weka nenosiri", "Set password")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Full profile ---------------------------------------------------------

function DriverProfileDrawer({ driver, onClose }: { driver: User; onClose: () => void }) {
  const { t, lang } = useApp();
  const { data: stats } = useDriverStats(driver.id);
  const { data: customers = [] } = useDriverCustomers(driver.id);
  const { data: routes = [] } = useDriverRoutes(driver.id);
  const { data: sales = [] } = useDriverRecentSales(driver.id);
  const { data: deposits = [] } = useDriverRecentDeposits(driver.id);
  const setActive = useSetDriverActive();

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-full text-white font-bold"
              style={{ background: driver.avatarColor }}
            >
              {driver.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <div>{driver.name}</div>
              <div className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                <Phone className="h-3 w-3" /> {driver.phone}
                <Mail className="h-3 w-3 ml-1" /> {driver.email}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
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

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Mauzo yote", "Total sales")}
            </div>
            <div className="font-num font-bold">{tzs(stats?.salesTotalTZS ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Mwezi huu", "This month")}
            </div>
            <div className="font-num font-bold">{tzs(stats?.salesThisMonthTZS ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Amana zote", "Deposits banked")}
            </div>
            <div className="font-num font-bold">{tzs(stats?.depositsTotalTZS ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Wateja aliohudumia", "Customers served")}
            </div>
            <div className="font-num font-bold">{num(stats?.distinctCustomers ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Njia alizoanzia", "Routes worked")}
            </div>
            <div className="font-num font-bold">{num(stats?.distinctRoutes ?? 0)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Mauzo ya mwisho", "Last sale")}
            </div>
            <div className="font-num font-bold text-xs pt-1">{stats?.lastSaleDate ?? "–"}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <RouteIcon className="h-3.5 w-3.5" /> {t("Njia alizoanzia", "Starting routes")}
          </div>
          {routes.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              {t("Hakuna upakiaji bado", "No loads recorded yet")}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {routes.map((r) => (
                <li key={r.locationId} className="flex items-center gap-3 px-3 py-2">
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
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <UserSquare2 className="h-3.5 w-3.5" />{" "}
            {t("Wateja waliounganishwa", "Linked customers")}
          </div>
          {customers.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              {t("Hakuna mauzo bado", "No sales recorded yet")}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm max-h-56 overflow-y-auto">
              {customers.map((c) => (
                <li key={c.customerId} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.salesCount} {t("mauzo", "sales")}
                    </div>
                  </div>
                  <div className="font-num font-semibold text-sm">{tzs(c.totalTZS)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold mb-2">
              {t("Mauzo ya hivi karibuni", "Recent sales")}
            </div>
            {sales.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">–</div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border text-xs">
                {sales.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">{s.date}</span>
                    <span className="font-num font-semibold">{tzs(s.totalTZS)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> {t("Amana za hivi karibuni", "Recent deposits")}
            </div>
            {deposits.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">–</div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border text-xs">
                {deposits.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">{d.date}</span>
                    <span className="font-num font-semibold">{tzs(d.amountTZS)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
