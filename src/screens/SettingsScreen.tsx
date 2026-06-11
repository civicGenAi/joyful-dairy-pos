import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/{settings,locations,audit};
// only static UI config (ROLE_LABEL) and types still come from @/mock/data.
import { ROLE_LABEL, type LocationKind, type AuditAction, type AuditModule } from "@/mock/data";
import type { Role, User } from "@/mock/types";
import {
  useUsers,
  useCreateUser,
  useSetUserRoles,
  useSetUserActive,
  useSetUserPassword,
  useDeleteUser,
  useCompany,
  useUpdateCompany,
  useAuditLog,
} from "@/lib/data/hooks/settings";
import {
  useLocations,
  useCreateLocation,
  useSetLocationActive,
  useDeleteLocation,
} from "@/lib/data/hooks/locations";
import { useAlerts } from "@/lib/data/hooks/reports";
import { useAlertReads, useMarkAlertsRead } from "@/lib/data/hooks/profile";
import { deviceLabel } from "@/lib/data/profile";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UserCog,
  Mail,
  Bell,
  Building2,
  MapPin,
  Plus,
  Trash2,
  Tag,
  Search,
  LogIn,
  LogOut as LogOutIcon,
  Pencil,
  Lock,
  CheckCircle2,
  Wallet,
  DollarSign,
  Printer,
  Download,
  ShieldCheck,
  FileClock,
  Eye,
  KeyRound,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";

const ALL_ROLES: Role[] = ["admin", "finance", "production", "sales", "route", "store", "viewer"];

const LOCATION_KIND_LABEL: Record<LocationKind, { sw: string; en: string }> = {
  "collection-point": { sw: "Pointi ya ukusanyaji", en: "Collection point" },
  plant: { sw: "Kiwanda", en: "Plant" },
  van: { sw: "Gari la njia", en: "Route van" },
  store: { sw: "Ghala la vifaa", en: "Consumables store" },
};

export function SettingsScreen() {
  const { t, lang, can } = useApp();
  const { data: users = [] } = useUsers();
  const { data: locations = [] } = useLocations();
  const setUserActive = useSetUserActive();
  const setUserRoles = useSetUserRoles();
  const setLocationActive = useSetLocationActive();
  const deleteLocation = useDeleteLocation();

  return (
    <AppShell title={t("Mipangilio", "Settings / Admin")}>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("Watumiaji & majukumu", "Users & roles")}</TabsTrigger>
          <TabsTrigger value="locations">{t("Maeneo", "Locations")}</TabsTrigger>
          {can("audit:read") && (
            <TabsTrigger value="audit">{t("Kumbukumbu", "Audit trail")}</TabsTrigger>
          )}
          <TabsTrigger value="notifications">{t("Arifa", "Notifications")}</TabsTrigger>
          <TabsTrigger value="company">{t("Kampuni", "Company")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("Vituo vya arifa", "Alert thresholds")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("Ratiba ya ripoti", "Report schedule")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Watumiaji", "Users")} value={users.length} accent="green" />
            <StatCard
              label={t("Wenye majukumu mengi", "Multi-role")}
              value={users.filter((u) => u.roles.length > 1).length}
              accent="info"
            />
            <StatCard
              label={t("Wamesimamishwa", "Disabled")}
              value={users.filter((u) => !u.active).length}
              accent="amber"
            />
            <StatCard
              label={t("Majukumu", "Roles defined")}
              value={ALL_ROLES.length}
              accent="green"
            />
          </div>

          <SectionCard title={t("Watumiaji wa mfumo", "System users")} action={<AddUserDialog />}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Mtumiaji", "User")}</th>
                  <th>{t("Barua pepe", "Email")}</th>
                  <th>{t("Majukumu (yawezekana mengi)", "Roles (multi)")}</th>
                  <th>{t("Hai", "Active")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border last:border-0 ${!u.active ? "opacity-60" : ""}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: u.avatarColor }}
                        >
                          {u.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{u.email}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Pill key={r} tone="success">
                            {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
                          </Pill>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Switch
                        checked={u.active}
                        onCheckedChange={(c) =>
                          setUserActive.mutate(
                            { id: u.id, name: u.name, active: c },
                            {
                              onSuccess: () =>
                                toast.success(
                                  c
                                    ? t("Akaunti imewashwa", "Account reinstated")
                                    : t("Akaunti imesimamishwa", "Account suspended"),
                                ),
                              onError: (e) =>
                                toast.error(
                                  e.message.includes("cannot-suspend-self")
                                    ? t(
                                        "Huwezi kujisimamisha mwenyewe",
                                        "You cannot suspend your own account",
                                      )
                                    : e.message.includes("last-admin")
                                      ? t(
                                          "Huwezi kumsimamisha admin wa mwisho",
                                          "Cannot suspend the last admin",
                                        )
                                      : t("Imeshindikana kubadilisha", "Could not update"),
                                ),
                            },
                          )
                        }
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <AssignRolesDialog
                          user={u}
                          onSave={(roles) =>
                            setUserRoles.mutate(
                              { id: u.id, name: u.name, roles },
                              {
                                onError: (e) =>
                                  toast.error(
                                    e.message.includes("last-admin")
                                      ? t(
                                          "Huwezi kumwondoa admin wa mwisho",
                                          "Cannot remove the last admin",
                                        )
                                      : t("Imeshindikana kuhifadhi", "Could not save roles"),
                                  ),
                              },
                            )
                          }
                        />
                        <UserActions user={u} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted-foreground">
              {t(
                "Kumbuka, mtumiaji mmoja anaweza kushikilia majukumu kadhaa kwa wakati mmoja. Admin pekee anaweza kuongeza au kufuta majukumu.",
                "Note: one user can hold multiple roles at once. Only Admin can assign or revoke roles.",
              )}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("Maeneo jumla", "Total locations")}
              value={locations.length}
              accent="green"
            />
            <StatCard
              label={t("Pointi za ukusanyaji", "Collection points")}
              value={locations.filter((l) => l.kind === "collection-point").length}
              accent="info"
            />
            <StatCard
              label={t("Magari ya njia", "Route vans")}
              value={locations.filter((l) => l.kind === "van").length}
              accent="amber"
            />
            <StatCard
              label={t("Hai", "Active")}
              value={locations.filter((l) => l.active).length}
              accent="green"
            />
          </div>

          <SectionCard title={t("Maeneo yote", "All locations")} action={<AddLocationDialog />}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Jina", "Name")}</th>
                  <th>{t("Aina", "Kind")}</th>
                  <th>{t("Maelezo", "Note")}</th>
                  <th>{t("Hai", "Active")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#1E7C3F]" />
                        <div>
                          <div className="font-medium">{loc.name}</div>
                          <div className="text-xs text-muted-foreground">{loc.swName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Pill tone="info">
                        {lang === "sw"
                          ? LOCATION_KIND_LABEL[loc.kind].sw
                          : LOCATION_KIND_LABEL[loc.kind].en}
                      </Pill>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{loc.note}</td>
                    <td className="py-2.5">
                      <Switch
                        checked={loc.active}
                        onCheckedChange={(c) =>
                          setLocationActive.mutate(
                            { id: loc.id, name: loc.name, active: c },
                            {
                              onError: () =>
                                toast.error(t("Imeshindikana kubadilisha", "Could not update")),
                            },
                          )
                        }
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <ConfirmDialog
                        destructive
                        title={t("Futa eneo?", "Delete location?")}
                        description={t(
                          "Eneo halitaonekana kwenye fomu za uhamishaji, mauzo wala uzalishaji.",
                          "It will no longer appear in transfers, sales, or production forms.",
                        )}
                        onConfirm={() =>
                          deleteLocation.mutate(
                            { id: loc.id, name: loc.name },
                            {
                              onSuccess: () =>
                                toast.success(t("Eneo limefutwa", "Location deleted")),
                              onError: () =>
                                toast.error(t("Imeshindikana kufuta", "Could not delete")),
                            },
                          )
                        }
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-[#E11B22]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        {can("audit:read") && (
          <TabsContent value="audit" className="mt-4">
            <AuditTrail />
          </TabsContent>
        )}

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <CompanyTab />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertThresholdsTab />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <SectionCard
            title={t("Wapokeaji wa ripoti otomatiki", "Auto-report recipients")}
            action={<Mail className="h-4 w-4 text-muted-foreground" />}
          >
            <p className="text-sm text-muted-foreground mb-3">
              {t(
                "Tumia ukurasa wa Ripoti kuona ratiba kamili pamoja na previewing.",
                "Use the Reports page for the full schedule grid with preview.",
              )}
            </p>
            <div className="rounded-xl bg-secondary/60 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#1E7C3F]" /> owner@africanjoy.co.tz,{" "}
                {t("kila siku", "daily")}, {t("kila wiki", "weekly")}, {t("kila mwezi", "monthly")}
              </div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#1E7C3F]" /> WhatsApp +255 754 100 000,{" "}
                {t("muhtasari wa kila siku", "daily summary")}
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#1E7C3F]" /> SMS digest,{" "}
                {t("kila siku saa 18:30", "every day at 18:30")}
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AssignRolesDialog({ user, onSave }: { user: User; onSave: (roles: Role[]) => void }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Role[]>(user.roles);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSel(user.roles);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <UserCog className="h-3.5 w-3.5 mr-1.5" />
          {t("Hariri majukumu", "Assign roles")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Majukumu ya", "Roles for")} {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ROLES.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2 rounded-xl border border-border p-2.5 cursor-pointer hover:bg-accent"
            >
              <Checkbox
                checked={sel.includes(r)}
                onCheckedChange={(c) => setSel((s) => (c ? [...s, r] : s.filter((x) => x !== r)))}
              />
              <span className="text-sm font-medium">
                {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {t(
            "Mtumiaji atapata muunganiko wa uwezo wa majukumu yote yaliyochaguliwa.",
            "User gets the union of capabilities from all selected roles.",
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(sel);
              toast.success(t("Majukumu yamehifadhiwa", "Roles saved"));
              setOpen(false);
            }}
          >
            {t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog() {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<Role[]>(["sales"]);
  const [password, setPassword] = useState("");
  const create = useCreateUser();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Mtumiaji mpya", "Add user")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Sajili mtumiaji mpya", "Register a new user")}</DialogTitle>
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
              placeholder="name@africanjoy.co.tz"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Nenosiri la kuanzia", "Initial password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Angalau herufi 6", "At least 6 characters")}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Majukumu (chagua moja au zaidi)", "Roles (pick one or more)")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_ROLES.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={roles.includes(r)}
                    onCheckedChange={(c) =>
                      setRoles((s) => (c ? [...s, r] : s.filter((x) => x !== r)))
                    }
                  />
                  <span className="text-xs">
                    {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !email.trim()) return;
              if (password.length < 6) {
                toast.error(
                  t("Nenosiri liwe angalau herufi 6", "Password must be at least 6 characters"),
                );
                return;
              }
              create.mutate(
                { name, email, phone, roles: roles.length ? roles : ["viewer"], password },
                {
                  onSuccess: () => {
                    toast.success(
                      t(
                        "Mtumiaji ameongezwa, anaweza kuingia sasa",
                        "User added and can sign in now",
                      ),
                    );
                    setOpen(false);
                    setName("");
                    setEmail("");
                    setPhone("");
                    setPassword("");
                    setRoles(["sales"]);
                  },
                  onError: (e) =>
                    toast.error(
                      e.message.includes("email-taken")
                        ? t("Barua pepe tayari inatumika", "Email is already in use")
                        : e.message.includes("weak-password")
                          ? t("Nenosiri ni fupi mno", "Password is too short")
                          : t("Imeshindikana kuongeza", "Could not add user"),
                    ),
                },
              );
            }}
            disabled={create.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {create.isPending ? t("Inasajili…", "Registering…") : t("Sajili", "Register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocationDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [swName, setSwName] = useState("");
  const [kind, setKind] = useState<LocationKind>("collection-point");
  const [note, setNote] = useState("");
  const create = useCreateLocation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Eneo jipya", "Add location")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Ongeza eneo", "Add a location")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Jina (English)", "Name (English)")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Jina la Kiswahili", "Swahili name")}</Label>
              <Input value={swName} onChange={(e) => setSwName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Aina", "Kind")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as LocationKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collection-point">
                  {t("Pointi ya ukusanyaji", "Collection point")}
                </SelectItem>
                <SelectItem value="plant">{t("Kiwanda", "Plant")}</SelectItem>
                <SelectItem value="van">{t("Gari la njia", "Route van")}</SelectItem>
                <SelectItem value="store">{t("Ghala", "Store")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Maelezo (hiari)", "Note (optional)")}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Mfano, Driver Baraka", "e.g. Driver Baraka")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              create.mutate(
                { name, swName: swName || name, kind, note: note || undefined },
                {
                  onSuccess: () => {
                    toast.success(t("Eneo limeongezwa", "Location added"));
                    setOpen(false);
                    setName("");
                    setSwName("");
                    setNote("");
                  },
                  onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add location")),
                },
              );
            }}
            disabled={create.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_META: Record<
  AuditAction,
  {
    icon: typeof LogIn;
    tone: "success" | "warning" | "danger" | "info" | "slate";
    sw: string;
    en: string;
  }
> = {
  login: { icon: LogIn, tone: "info", sw: "Kuingia", en: "Login" },
  logout: { icon: LogOutIcon, tone: "slate", sw: "Kutoka", en: "Logout" },
  create: { icon: Plus, tone: "success", sw: "Kuunda", en: "Create" },
  edit: { icon: Pencil, tone: "warning", sw: "Kuhariri", en: "Edit" },
  delete: { icon: Trash2, tone: "danger", sw: "Kufuta", en: "Delete" },
  "lock-day": { icon: Lock, tone: "info", sw: "Kufunga siku", en: "Lock day" },
  confirm: { icon: CheckCircle2, tone: "success", sw: "Kuthibitisha", en: "Confirm" },
  payout: { icon: Wallet, tone: "warning", sw: "Malipo", en: "Payout" },
  deposit: { icon: DollarSign, tone: "success", sw: "Amana", en: "Deposit" },
  "price-change": { icon: Tag, tone: "warning", sw: "Bei", en: "Price change" },
  "role-change": { icon: ShieldCheck, tone: "warning", sw: "Jukumu", en: "Role change" },
  export: { icon: Download, tone: "slate", sw: "Kuhamisha", en: "Export" },
  print: { icon: Printer, tone: "slate", sw: "Kuchapisha", en: "Print" },
};

function AuditTrail() {
  const { t, lang } = useApp();
  const { data: auditLog = [] } = useAuditLog();
  const [q, setQ] = useState("");
  const [action, setAction] = useState<AuditAction | "all">("all");
  const [moduleFilter, setModuleFilter] = useState<AuditModule | "all">("all");

  const modules: AuditModule[] = [
    "auth",
    "farmers",
    "customers",
    "production",
    "stock",
    "reconciliation",
    "finance",
    "products",
    "settings",
    "pos",
    "route",
  ];

  const filtered = useMemo(
    () =>
      auditLog.filter((e) => {
        if (action !== "all" && e.action !== action) return false;
        if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
        if (q) {
          const needle = q.toLowerCase();
          const text = `${e.actor} ${e.summary.en} ${e.summary.sw}`.toLowerCase();
          if (!text.includes(needle)) return false;
        }
        return true;
      }),
    [auditLog, q, action, moduleFilter],
  );

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(lang === "sw" ? "sw-TZ" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t("Vitendo leo", "Actions today")}
          value={auditLog.length}
          accent="green"
        />
        <StatCard
          label={t("Kuingia", "Logins")}
          value={auditLog.filter((e) => e.action === "login").length}
          accent="info"
        />
        <StatCard
          label={t("Mabadiliko", "Edits & deletes")}
          value={auditLog.filter((e) => e.action === "edit" || e.action === "delete").length}
          accent="amber"
        />
        <StatCard
          label={t("Watumiaji hai", "Distinct actors")}
          value={new Set(auditLog.map((e) => e.actor)).size}
          accent="green"
        />
      </div>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-1.5">
            <FileClock className="h-4 w-4" /> {t("Kumbukumbu za matendo", "Audit trail")}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-44 pl-8 text-xs"
                placeholder={t("Tafuta…", "Search…")}
              />
            </div>
            <Select value={action} onValueChange={(v) => setAction(v as AuditAction | "all")}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Vitendo vyote", "All actions")}</SelectItem>
                {(Object.keys(ACTION_META) as AuditAction[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {lang === "sw" ? ACTION_META[a].sw : ACTION_META[a].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={moduleFilter}
              onValueChange={(v) => setModuleFilter(v as AuditModule | "all")}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Moduli zote", "All modules")}</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu formats={["csv", "excel"]} filename="audit-trail" />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title={t("Hakuna kumbukumbu", "No matching entries")}
            description={t("Badilisha kichujio au utafutaji.", "Adjust the filter or search.")}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Wakati", "Time")}</th>
                <th>{t("Mtumiaji", "Actor")}</th>
                <th>{t("Kitendo", "Action")}</th>
                <th>{t("Moduli", "Module")}</th>
                <th>{t("Maelezo", "Details")}</th>
                <th>{t("Kifaa", "Device")}</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = ACTION_META[e.action];
                const Icon = meta.icon;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground whitespace-nowrap">
                      {fmtTime(e.at)}
                    </td>
                    <td className="py-2.5">
                      <div className="font-medium">{e.actor}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {e.actorRole}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Pill tone={meta.tone}>
                        <Icon className="h-3 w-3" />
                        {lang === "sw" ? meta.sw : meta.en}
                      </Pill>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{e.module}</td>
                    <td className="py-2.5">{lang === "sw" ? e.summary.sw : e.summary.en}</td>
                    <td className="py-2.5 text-xs text-muted-foreground" title={e.device}>
                      {e.device ? deviceLabel(e.device) : "·"}
                    </td>
                    <td className="py-2.5 font-num text-xs text-muted-foreground">{e.ip ?? "·"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          {t(
            "Kumbukumbu hii inaonyesha kila kitendo cha mfumo, kuingia, kuhariri, kufuta, kufunga siku na zaidi. Admin pekee ndiye anaweza kuiona.",
            "This log captures every system action, logins, edits, deletes, day-close and more. Only Admin can view it.",
          )}
        </div>
      </SectionCard>
    </>
  );
}

function CompanyTab() {
  const { t } = useApp();
  const { data: company } = useCompany();
  const update = useUpdateCompany();
  const [form, setForm] = useState<Record<string, string>>({});
  const val = (k: "name" | "city" | "phone" | "email" | "footer" | "tin" | "vrn") =>
    form[k] ?? company?.[k] ?? "";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => {
    update.mutate(
      {
        name: val("name"),
        city: val("city"),
        phone: val("phone"),
        email: val("email"),
        footer: val("footer"),
        tin: val("tin"),
        vrn: val("vrn"),
      },
      {
        onSuccess: () => toast.success(t("Mipangilio imehifadhiwa", "Settings saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save settings")),
      },
    );
  };

  return (
    <SectionCard
      title={t("Profaili ya kampuni", "Company profile")}
      action={<Building2 className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label>{t("Jina la kampuni", "Company name")}</Label>
            <Input value={val("name")} onChange={set("name")} />
          </div>
          <div>
            <Label>{t("Eneo", "Location")}</Label>
            <Input value={val("city")} onChange={set("city")} />
          </div>
          <div>
            <Label>{t("Simu ya msaada", "Support phone")}</Label>
            <Input value={val("phone")} onChange={set("phone")} />
          </div>
          <div>
            <Label>{t("Barua pepe", "Email")}</Label>
            <Input value={val("email")} onChange={set("email")} />
          </div>
          <div>
            <Label>{t("Lugha chaguo-msingi", "Default language")}</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue="sw"
            >
              <option value="sw">Kiswahili</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>{t("Ujumbe wa risiti", "Receipt footer")}</Label>
            <Input value={val("footer")} onChange={set("footer")} />
          </div>
          <div>
            <Label>{t("Sarafu", "Currency")}</Label>
            <Input defaultValue="TZS" readOnly />
          </div>
          <div>
            <Label>{t("Eneo la wakati", "Timezone")}</Label>
            <Input defaultValue="Africa/Dar_es_Salaam" readOnly />
          </div>
          <div>
            <Label>{t("TIN", "TIN")}</Label>
            <Input value={val("tin")} onChange={set("tin")} />
          </div>
          <div>
            <Label>{t("VRN", "VRN")}</Label>
            <Input value={val("vrn")} onChange={set("vrn")} />
          </div>
          <Button
            className="mt-2 text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            disabled={update.isPending}
            onClick={save}
          >
            {update.isPending
              ? t("Inahifadhi…", "Saving…")
              : t("Hifadhi mipangilio", "Save settings")}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

const THRESHOLD_FIELDS: { key: string; sw: string; en: string; fallback: number }[] = [
  {
    key: "freshLowL",
    sw: "Litre za chini za fresh milk",
    en: "Fresh milk low threshold (L)",
    fallback: 100,
  },
  {
    key: "mtindiLowL",
    sw: "Litre za chini za mtindi",
    en: "Mtindi low threshold (L)",
    fallback: 80,
  },
  {
    key: "butterLowPcs",
    sw: "Idadi ya chini ya butter",
    en: "Butter low threshold (pcs)",
    fallback: 20,
  },
  {
    key: "overdueDays",
    sw: "Siku za madeni kabla ya arifa",
    en: "Days credit aged before warning",
    fallback: 14,
  },
  {
    key: "spoilagePctWarn",
    sw: "Asilimia ya juu ya spoilage",
    en: "Max spoilage % per day",
    fallback: 3,
  },
  {
    key: "payableWarningDays",
    sw: "Siku kabla ya mzunguko wa malipo",
    en: "Days before payout cycle warning",
    fallback: 3,
  },
  {
    key: "dayCloseNagHours",
    sw: "Saa za kungoja kufunga siku",
    en: "Hours after midnight to nag day-close",
    fallback: 6,
  },
  {
    key: "vikopoRoboLow",
    sw: "Vikopo robo, kiwango cha chini",
    en: "Vikopo robo (containers) low threshold",
    fallback: 200,
  },
];

function AlertThresholdsTab() {
  const { t } = useApp();
  const { data: company } = useCompany();
  const update = useUpdateCompany();
  const [form, setForm] = useState<Record<string, number>>({});
  const val = (key: string, fallback: number) =>
    form[key] ?? Number(company?.alertThresholds?.[key] ?? fallback);

  const save = () => {
    const thresholds: Record<string, number> = {};
    for (const f of THRESHOLD_FIELDS) thresholds[f.key] = val(f.key, f.fallback);
    update.mutate(
      { alertThresholds: thresholds },
      {
        onSuccess: () => toast.success(t("Mipaka imehifadhiwa", "Thresholds saved")),
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save thresholds")),
      },
    );
  };

  return (
    <SectionCard
      title={t("Mipaka ya arifa", "Alert thresholds")}
      action={<Bell className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3 max-w-2xl">
        {THRESHOLD_FIELDS.map((x) => (
          <div key={x.key} className="flex items-center gap-3">
            <div className="flex-1 text-sm">{t(x.sw, x.en)}</div>
            <Input
              type="number"
              value={val(x.key, x.fallback)}
              onChange={(e) => setForm((f) => ({ ...f, [x.key]: Number(e.target.value) }))}
              className="w-28 font-num text-right"
            />
          </div>
        ))}
        <Button
          className="text-white mt-3"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          disabled={update.isPending}
          onClick={save}
        >
          {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
        </Button>
      </div>
    </SectionCard>
  );
}

function UserActions({ user }: { user: User }) {
  const { t, lang } = useApp();
  const [infoOpen, setInfoOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [password, setPassword] = useState("");
  const setUserPassword = useSetUserPassword();
  const deleteUser = useDeleteUser();

  const savePassword = () => {
    if (password.length < 6) {
      toast.error(t("Nenosiri liwe angalau herufi 6", "Password must be at least 6 characters"));
      return;
    }
    setUserPassword.mutate(
      { id: user.id, password },
      {
        onSuccess: () => {
          toast.success(t("Nenosiri limebadilishwa", "Password changed"));
          setPwdOpen(false);
          setPassword("");
        },
        onError: (e) =>
          toast.error(
            e.message.includes("no-auth-account")
              ? t("Akaunti ya kuingia haipo bado", "No sign-in account exists yet")
              : t("Imeshindikana kubadilisha nenosiri", "Could not change the password"),
          ),
      },
    );
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        title={t("Taarifa za mtumiaji", "User information")}
        onClick={() => setInfoOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        title={t("Badilisha nenosiri", "Change password")}
        onClick={() => setPwdOpen(true)}
      >
        <KeyRound className="h-3.5 w-3.5" />
      </Button>
      <ConfirmDialog
        destructive
        title={t("Futa mtumiaji?", "Delete user?")}
        description={t(
          `${user.name} hataweza kuingia tena na akaunti yake itafutwa kabisa.`,
          `${user.name} will no longer be able to sign in and the account is removed permanently.`,
        )}
        confirmLabel={t("Futa", "Delete")}
        onConfirm={() =>
          deleteUser.mutate(
            { id: user.id, name: user.name },
            {
              onSuccess: () => toast.success(t("Mtumiaji amefutwa", "User deleted")),
              onError: (e) =>
                toast.error(
                  e.message.includes("cannot-delete-self")
                    ? t("Huwezi kujifuta mwenyewe", "You cannot delete your own account")
                    : e.message.includes("last-admin")
                      ? t("Huwezi kumfuta admin wa mwisho", "Cannot delete the last admin")
                      : t("Imeshindikana kufuta", "Could not delete the user"),
                ),
            },
          )
        }
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-[#E11B22]"
            title={t("Futa mtumiaji", "Delete user")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: user.avatarColor }}
              >
                {user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              {user.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
              <span className="text-muted-foreground">{t("Barua pepe", "Email")}</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
              <span className="text-muted-foreground">{t("Simu", "Phone")}</span>
              <span className="font-medium">{user.phone || "·"}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
              <span className="text-muted-foreground">{t("Hali", "Status")}</span>
              <Pill tone={user.active ? "success" : "danger"}>
                {user.active ? t("Hai", "Active") : t("Imesimamishwa", "Suspended")}
              </Pill>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <div className="text-muted-foreground mb-1.5">{t("Majukumu", "Roles")}</div>
              <div className="flex gap-1 flex-wrap">
                {user.roles.map((r) => (
                  <Pill key={r} tone="success">
                    {lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Badilisha nenosiri la", "Change password for")} {user.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{t("Nenosiri jipya", "New password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Angalau herufi 6", "At least 6 characters")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>
              {t("Ghairi", "Cancel")}
            </Button>
            <Button onClick={savePassword} disabled={setUserPassword.isPending}>
              {setUserPassword.isPending
                ? t("Inabadilisha…", "Changing…")
                : t("Badilisha", "Change")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ALERT_GROUPS: { kind: string; sw: string; en: string }[] = [
  { kind: "low-stock", sw: "Stock ndogo", en: "Low stock" },
  { kind: "overdue-credit", sw: "Madeni yaliyochelewa", en: "Overdue credit" },
  { kind: "farmer-payable", sw: "Malipo ya wafugaji", en: "Farmer payouts" },
  { kind: "day-unbalanced", sw: "Kufunga siku", en: "Day close" },
];

function NotificationsTab() {
  const { t } = useApp();
  const { data: alerts = [] } = useAlerts();
  const { data: reads = [] } = useAlertReads();
  const markRead = useMarkAlertsRead();
  const unread = alerts.filter((a) => !reads.includes(a.id));

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t("Arifa jumla", "Total notifications")}
          value={alerts.length}
          accent="green"
        />
        <StatCard label={t("Mpya", "Unread")} value={unread.length} accent="red" />
        <StatCard
          label={t("Zilizosomwa", "Read")}
          value={alerts.length - unread.length}
          accent="info"
        />
        <StatCard label={t("Makundi", "Categories")} value={ALERT_GROUPS.length} accent="amber" />
      </div>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> {t("Arifa za mfumo", "System notifications")}
          </span>
        }
        action={
          unread.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={markRead.isPending}
              onClick={() =>
                markRead.mutate(
                  unread.map((a) => a.id),
                  {
                    onSuccess: () => toast.success(t("Zote zimesomwa", "All marked as read")),
                  },
                )
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {t("Soma zote", "Mark all as read")}
            </Button>
          )
        }
      >
        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t("Hakuna arifa kwa sasa", "No notifications right now")}
            description={t(
              "Arifa huundwa moja kwa moja kutoka kwenye stock, madeni, malipo na kufunga siku.",
              "Notifications come straight from stock levels, credit, payouts and day-close.",
            )}
          />
        ) : (
          <div className="space-y-5">
            {ALERT_GROUPS.map((g) => {
              const items = alerts.filter((a) => a.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t(g.sw, g.en)} · {items.length}
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {items.map((a) => {
                      const isRead = reads.includes(a.id);
                      return (
                        <li
                          key={a.id}
                          className={`flex items-start gap-3 px-3 py-2.5 bg-card ${isRead ? "opacity-55" : ""}`}
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.severity === "danger" ? "bg-[#E11B22]" : a.severity === "warning" ? "bg-[#E5A100]" : "bg-[#1D9E75]"}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{a.title}</div>
                            <div className="text-xs text-muted-foreground">{a.detail}</div>
                          </div>
                          {isRead ? (
                            <Pill tone="slate">{t("Imesomwa", "Read")}</Pill>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs shrink-0"
                              onClick={() => markRead.mutate([a.id])}
                            >
                              {t("Soma", "Mark read")}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          {t(
            "Hali ya kusoma ni ya kila mtumiaji; arifa hupotea zenyewe tatizo likitatuliwa.",
            "Read-state is per user; a notification clears itself once the underlying issue is resolved.",
          )}
        </div>
      </SectionCard>
    </>
  );
}
