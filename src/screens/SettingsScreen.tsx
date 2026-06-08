import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { USERS, ROLE_LABEL, COMPANY, LOCATIONS, type Location, type LocationKind } from "@/mock/data";
import type { Role, User } from "@/mock/types";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Mail, Bell, Building2, MapPin, Plus, Trash2, Tag } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ALL_ROLES: Role[] = ["admin", "finance", "production", "sales", "route", "store", "viewer"];

const LOCATION_KIND_LABEL: Record<LocationKind, { sw: string; en: string }> = {
  "collection-point": { sw: "Pointi ya ukusanyaji", en: "Collection point" },
  "plant": { sw: "Kiwanda", en: "Plant" },
  "van": { sw: "Gari la njia", en: "Route van" },
  "store": { sw: "Ghala la vifaa", en: "Consumables store" },
};

export function SettingsScreen() {
  const { t, lang } = useApp();
  const [users, setUsers] = useState<User[]>(USERS);
  const [locations, setLocations] = useState<Location[]>(LOCATIONS);

  return (
    <AppShell title={t("Mipangilio", "Settings / Admin")}>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("Watumiaji & majukumu", "Users & roles")}</TabsTrigger>
          <TabsTrigger value="locations">{t("Maeneo", "Locations")}</TabsTrigger>
          <TabsTrigger value="company">{t("Kampuni", "Company")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("Vituo vya arifa", "Alert thresholds")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("Ratiba ya ripoti", "Report schedule")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Watumiaji", "Users")} value={users.length} accent="green" />
            <StatCard label={t("Wenye majukumu mengi", "Multi-role")} value={users.filter((u) => u.roles.length > 1).length} accent="info" />
            <StatCard label={t("Wamesimamishwa", "Disabled")} value={users.filter((u) => !u.active).length} accent="amber" />
            <StatCard label={t("Majukumu", "Roles defined")} value={ALL_ROLES.length} accent="green" />
          </div>

          <SectionCard title={t("Watumiaji wa mfumo", "System users")} action={<AddUserDialog onAdd={(u) => setUsers((xs) => [u, ...xs])} />}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Mtumiaji", "User")}</th><th>{t("Barua pepe", "Email")}</th><th>{t("Majukumu (yawezekana mengi)", "Roles (multi)")}</th><th>{t("Hai", "Active")}</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`border-b border-border last:border-0 ${!u.active ? "opacity-60" : ""}`}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: u.avatarColor }}>{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span className="font-medium">{u.name}</span></div>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{u.email}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => <Pill key={r} tone="success">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</Pill>)}
                      </div>
                    </td>
                    <td className="py-2.5"><Switch checked={u.active} onCheckedChange={(c) => setUsers((xs) => xs.map((x) => x.id === u.id ? { ...x, active: c } : x))} /></td>
                    <td className="py-2.5 text-right">
                      <AssignRolesDialog
                        user={u}
                        onSave={(roles) => setUsers((xs) => xs.map((x) => x.id === u.id ? { ...x, roles } : x))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted-foreground">
              {t("Kumbuka, mtumiaji mmoja anaweza kushikilia majukumu kadhaa kwa wakati mmoja. Admin pekee anaweza kuongeza au kufuta majukumu.", "Note: one user can hold multiple roles at once. Only Admin can assign or revoke roles.")}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Maeneo jumla", "Total locations")} value={locations.length} accent="green" />
            <StatCard label={t("Pointi za ukusanyaji", "Collection points")} value={locations.filter((l) => l.kind === "collection-point").length} accent="info" />
            <StatCard label={t("Magari ya njia", "Route vans")} value={locations.filter((l) => l.kind === "van").length} accent="amber" />
            <StatCard label={t("Hai", "Active")} value={locations.filter((l) => l.active).length} accent="green" />
          </div>

          <SectionCard title={t("Maeneo yote", "All locations")} action={<AddLocationDialog onAdd={(loc) => setLocations((xs) => [...xs, loc])} />}>
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
                    <td className="py-2.5"><Pill tone="info">{lang === "sw" ? LOCATION_KIND_LABEL[loc.kind].sw : LOCATION_KIND_LABEL[loc.kind].en}</Pill></td>
                    <td className="py-2.5 text-xs text-muted-foreground">{loc.note}</td>
                    <td className="py-2.5"><Switch checked={loc.active} onCheckedChange={(c) => setLocations((xs) => xs.map((x) => x.id === loc.id ? { ...x, active: c } : x))} /></td>
                    <td className="py-2.5 text-right">
                      <ConfirmDialog
                        destructive
                        title={t("Futa eneo?", "Delete location?")}
                        description={t("Eneo halitaonekana kwenye fomu za uhamishaji, mauzo wala uzalishaji.", "It will no longer appear in transfers, sales, or production forms.")}
                        onConfirm={() => setLocations((xs) => xs.filter((x) => x.id !== loc.id))}
                        trigger={<Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-[#E11B22]"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <SectionCard title={t("Profaili ya kampuni", "Company profile")} action={<Building2 className="h-4 w-4 text-muted-foreground" />}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div><Label>{t("Jina la kampuni", "Company name")}</Label><Input defaultValue={COMPANY.name} /></div>
                <div><Label>{t("Eneo", "Location")}</Label><Input defaultValue={COMPANY.city} /></div>
                <div><Label>{t("Simu ya msaada", "Support phone")}</Label><Input defaultValue={COMPANY.phone} /></div>
                <div><Label>{t("Barua pepe", "Email")}</Label><Input defaultValue={COMPANY.email} /></div>
                <div><Label>{t("Lugha chaguo-msingi", "Default language")}</Label>
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="sw"><option value="sw">Kiswahili</option><option value="en">English</option></select>
                </div>
              </div>
              <div className="space-y-3">
                <div><Label>{t("Ujumbe wa risiti", "Receipt footer")}</Label><Input defaultValue={COMPANY.footer} /></div>
                <div><Label>{t("Sarafu", "Currency")}</Label><Input defaultValue="TZS" /></div>
                <div><Label>{t("Eneo la wakati", "Timezone")}</Label><Input defaultValue="Africa/Dar_es_Salaam" /></div>
                <div><Label>{t("TIN", "TIN")}</Label><Input defaultValue={COMPANY.tin} /></div>
                <div><Label>{t("VRN", "VRN")}</Label><Input defaultValue={COMPANY.vrn} /></div>
                <Button className="mt-2 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Mipangilio imehifadhiwa", "Settings saved"))}>{t("Hifadhi mipangilio", "Save settings")}</Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <SectionCard title={t("Mipaka ya arifa", "Alert thresholds")} action={<Bell className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3 max-w-2xl">
              {[
                { label: t("Litre za chini za fresh milk", "Fresh milk low threshold (L)"), v: 100 },
                { label: t("Litre za chini za mtindi", "Mtindi low threshold (L)"), v: 80 },
                { label: t("Idadi ya chini ya butter", "Butter low threshold (pcs)"), v: 20 },
                { label: t("Siku za madeni kabla ya arifa", "Days credit aged before warning"), v: 14 },
                { label: t("Asilimia ya juu ya spoilage", "Max spoilage % per day"), v: 3 },
                { label: t("Siku kabla ya mzunguko wa malipo", "Days before payout cycle warning"), v: 3 },
                { label: t("Saa za kungoja kufunga siku", "Hours after midnight to nag day-close"), v: 6 },
                { label: t("Vikopo robo, kiwango cha chini", "Vikopo robo (containers) low threshold"), v: 200 },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-3"><div className="flex-1 text-sm">{x.label}</div><Input type="number" defaultValue={x.v} className="w-28 font-num text-right" /></div>
              ))}
              <Button className="text-white mt-3" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Mipaka imehifadhiwa", "Thresholds saved"))}>{t("Hifadhi", "Save")}</Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <SectionCard title={t("Wapokeaji wa ripoti otomatiki", "Auto-report recipients")} action={<Mail className="h-4 w-4 text-muted-foreground" />}>
            <p className="text-sm text-muted-foreground mb-3">{t("Tumia ukurasa wa Ripoti kuona ratiba kamili pamoja na previewing.", "Use the Reports page for the full schedule grid with preview.")}</p>
            <div className="rounded-xl bg-secondary/60 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#1E7C3F]" /> owner@africanjoy.co.tz, {t("kila siku", "daily")}, {t("kila wiki", "weekly")}, {t("kila mwezi", "monthly")}</div>
              <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#1E7C3F]" /> WhatsApp {COMPANY.phone}, {t("muhtasari wa kila siku", "daily summary")}</div>
              <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#1E7C3F]" /> SMS digest, {t("kila siku saa 18:30", "every day at 18:30")}</div>
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setSel(user.roles); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs"><UserCog className="h-3.5 w-3.5 mr-1.5" />{t("Hariri majukumu", "Assign roles")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Majukumu ya", "Roles for")} {user.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-xl border border-border p-2.5 cursor-pointer hover:bg-accent">
              <Checkbox checked={sel.includes(r)} onCheckedChange={(c) => setSel((s) => c ? [...s, r] : s.filter((x) => x !== r))} />
              <span className="text-sm font-medium">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {t("Mtumiaji atapata muunganiko wa uwezo wa majukumu yote yaliyochaguliwa.", "User gets the union of capabilities from all selected roles.")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => { onSave(sel); toast.success(t("Majukumu yamehifadhiwa", "Roles saved")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button>
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
        <Button size="sm" className="h-8 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
          <Plus className="h-3.5 w-3.5 mr-1" />{t("Mtumiaji mpya", "Add user")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Sajili mtumiaji mpya", "Register a new user")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Jina kamili", "Full name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>{t("Simu", "Phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 7xx xxx xxx" /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Barua pepe", "Email")}</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@africanjoy.co.tz" /></div>
          <div className="grid gap-1.5">
            <Label>{t("Majukumu (chagua moja au zaidi)", "Roles (pick one or more)")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={(c) => setRoles((s) => c ? [...s, r] : s.filter((x) => x !== r))} />
                  <span className="text-xs">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => {
            if (!name.trim() || !email.trim()) return;
            onAdd({
              id: `u-new-${Date.now()}`,
              name, email, phone,
              roles: roles.length ? roles : ["viewer"],
              active: true,
              avatarColor: ["#1E7C3F", "#2F9E44", "#6FBF59", "#8CC63F", "#1D9E75", "#14532D", "#E5A100", "#E11B22"][Math.floor(Math.random() * 8)],
            });
            toast.success(t("Mtumiaji ameongezwa", "User added"));
            setOpen(false);
            setName(""); setEmail(""); setPhone(""); setRoles(["sales"]);
          }} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>{t("Sajili", "Register")}</Button>
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
        <Button size="sm" className="h-8 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
          <Plus className="h-3.5 w-3.5 mr-1" />{t("Eneo jipya", "Add location")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Ongeza eneo", "Add a location")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Jina (English)", "Name (English)")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>{t("Jina la Kiswahili", "Swahili name")}</Label><Input value={swName} onChange={(e) => setSwName(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Aina", "Kind")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as LocationKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collection-point">{t("Pointi ya ukusanyaji", "Collection point")}</SelectItem>
                <SelectItem value="plant">{t("Kiwanda", "Plant")}</SelectItem>
                <SelectItem value="van">{t("Gari la njia", "Route van")}</SelectItem>
                <SelectItem value="store">{t("Ghala", "Store")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>{t("Maelezo (hiari)", "Note (optional)")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Mfano, Driver Baraka", "e.g. Driver Baraka")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => {
            if (!name.trim()) return;
            onAdd({ id: `loc-new-${Date.now()}`, name, swName: swName || name, kind, note: note || undefined, active: true });
            toast.success(t("Eneo limeongezwa", "Location added"));
            setOpen(false);
            setName(""); setSwName(""); setNote("");
          }} className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
