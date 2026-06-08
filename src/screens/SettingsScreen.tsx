import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import {
  USERS,
  ROLE_LABEL,
  COMPANY,
  LOCATIONS,
  AUDIT_LOG,
  type Location,
  type LocationKind,
  type AuditAction,
  type AuditModule,
} from "@/mock/data";
import type { Role, User } from "@/mock/types";
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
  const [users, setUsers] = useState<User[]>(USERS);
  const [locations, setLocations] = useState<Location[]>(LOCATIONS);

  return (
    <AppShell title={t("Mipangilio", "Settings / Admin")}>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("Watumiaji & majukumu", "Users & roles")}</TabsTrigger>
          <TabsTrigger value="locations">{t("Maeneo", "Locations")}</TabsTrigger>
          {can("audit:read") && (
            <TabsTrigger value="audit">{t("Kumbukumbu", "Audit trail")}</TabsTrigger>
          )}
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

          <SectionCard
            title={t("Watumiaji wa mfumo", "System users")}
            action={<AddUserDialog onAdd={(u) => setUsers((xs) => [u, ...xs])} />}
          >
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
                          setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, active: c } : x)))
                        }
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <AssignRolesDialog
                        user={u}
                        onSave={(roles) =>
                          setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, roles } : x)))
                        }
                      />
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

          <SectionCard
            title={t("Maeneo yote", "All locations")}
            action={<AddLocationDialog onAdd={(loc) => setLocations((xs) => [...xs, loc])} />}
          >
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
                          setLocations((xs) =>
                            xs.map((x) => (x.id === loc.id ? { ...x, active: c } : x)),
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
                        onConfirm={() => setLocations((xs) => xs.filter((x) => x.id !== loc.id))}
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

        <TabsContent value="company" className="mt-4">
          <SectionCard
            title={t("Profaili ya kampuni", "Company profile")}
            action={<Building2 className="h-4 w-4 text-muted-foreground" />}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label>{t("Jina la kampuni", "Company name")}</Label>
                  <Input defaultValue={COMPANY.name} />
                </div>
                <div>
                  <Label>{t("Eneo", "Location")}</Label>
                  <Input defaultValue={COMPANY.city} />
                </div>
                <div>
                  <Label>{t("Simu ya msaada", "Support phone")}</Label>
                  <Input defaultValue={COMPANY.phone} />
                </div>
                <div>
                  <Label>{t("Barua pepe", "Email")}</Label>
                  <Input defaultValue={COMPANY.email} />
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
                  <Input defaultValue={COMPANY.footer} />
                </div>
                <div>
                  <Label>{t("Sarafu", "Currency")}</Label>
                  <Input defaultValue="TZS" />
                </div>
                <div>
                  <Label>{t("Eneo la wakati", "Timezone")}</Label>
                  <Input defaultValue="Africa/Dar_es_Salaam" />
                </div>
                <div>
                  <Label>{t("TIN", "TIN")}</Label>
                  <Input defaultValue={COMPANY.tin} />
                </div>
                <div>
                  <Label>{t("VRN", "VRN")}</Label>
                  <Input defaultValue={COMPANY.vrn} />
                </div>
                <Button
                  className="mt-2 text-white"
                  style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                  onClick={() => toast.success(t("Mipangilio imehifadhiwa", "Settings saved"))}
                >
                  {t("Hifadhi mipangilio", "Save settings")}
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <SectionCard
            title={t("Mipaka ya arifa", "Alert thresholds")}
            action={<Bell className="h-4 w-4 text-muted-foreground" />}
          >
            <div className="space-y-3 max-w-2xl">
              {[
                {
                  label: t("Litre za chini za fresh milk", "Fresh milk low threshold (L)"),
                  v: 100,
                },
                { label: t("Litre za chini za mtindi", "Mtindi low threshold (L)"), v: 80 },
                { label: t("Idadi ya chini ya butter", "Butter low threshold (pcs)"), v: 20 },
                {
                  label: t("Siku za madeni kabla ya arifa", "Days credit aged before warning"),
                  v: 14,
                },
                { label: t("Asilimia ya juu ya spoilage", "Max spoilage % per day"), v: 3 },
                {
                  label: t("Siku kabla ya mzunguko wa malipo", "Days before payout cycle warning"),
                  v: 3,
                },
                {
                  label: t("Saa za kungoja kufunga siku", "Hours after midnight to nag day-close"),
                  v: 6,
                },
                {
                  label: t(
                    "Vikopo robo, kiwango cha chini",
                    "Vikopo robo (containers) low threshold",
                  ),
                  v: 200,
                },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-3">
                  <div className="flex-1 text-sm">{x.label}</div>
                  <Input type="number" defaultValue={x.v} className="w-28 font-num text-right" />
                </div>
              ))}
              <Button
                className="text-white mt-3"
                style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                onClick={() => toast.success(t("Mipaka imehifadhiwa", "Thresholds saved"))}
              >
                {t("Hifadhi", "Save")}
              </Button>
            </div>
          </SectionCard>
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
                <Bell className="h-4 w-4 text-[#1E7C3F]" /> WhatsApp {COMPANY.phone},{" "}
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

function AddUserDialog({ onAdd }: { onAdd: (u: User) => void }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<Role[]>(["sales"]);

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
              onAdd({
                id: `u-new-${Date.now()}`,
                name,
                email,
                phone,
                roles: roles.length ? roles : ["viewer"],
                active: true,
                avatarColor: [
                  "#1E7C3F",
                  "#2F9E44",
                  "#6FBF59",
                  "#8CC63F",
                  "#1D9E75",
                  "#14532D",
                  "#E5A100",
                  "#E11B22",
                ][Math.floor(Math.random() * 8)],
              });
              toast.success(t("Mtumiaji ameongezwa", "User added"));
              setOpen(false);
              setName("");
              setEmail("");
              setPhone("");
              setRoles(["sales"]);
            }}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {t("Sajili", "Register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLocationDialog({ onAdd }: { onAdd: (loc: Location) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [swName, setSwName] = useState("");
  const [kind, setKind] = useState<LocationKind>("collection-point");
  const [note, setNote] = useState("");

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
              onAdd({
                id: `loc-new-${Date.now()}`,
                name,
                swName: swName || name,
                kind,
                note: note || undefined,
                active: true,
              });
              toast.success(t("Eneo limeongezwa", "Location added"));
              setOpen(false);
              setName("");
              setSwName("");
              setNote("");
            }}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {t("Hifadhi", "Save")}
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
      AUDIT_LOG.filter((e) => {
        if (action !== "all" && e.action !== action) return false;
        if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
        if (q) {
          const needle = q.toLowerCase();
          const text = `${e.actor} ${e.summary.en} ${e.summary.sw}`.toLowerCase();
          if (!text.includes(needle)) return false;
        }
        return true;
      }),
    [q, action, moduleFilter],
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
          value={AUDIT_LOG.length}
          accent="green"
        />
        <StatCard
          label={t("Kuingia", "Logins")}
          value={AUDIT_LOG.filter((e) => e.action === "login").length}
          accent="info"
        />
        <StatCard
          label={t("Mabadiliko", "Edits & deletes")}
          value={AUDIT_LOG.filter((e) => e.action === "edit" || e.action === "delete").length}
          accent="amber"
        />
        <StatCard
          label={t("Watumiaji hai", "Distinct actors")}
          value={new Set(AUDIT_LOG.map((e) => e.actor)).size}
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
                    <td className="py-2.5 font-num text-xs text-muted-foreground">{e.ip}</td>
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
