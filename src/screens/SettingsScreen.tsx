import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { USERS, ROLE_LABEL, COMPANY } from "@/mock/data";
import type { Role } from "@/mock/types";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Building2, Bell, Mail, Tag } from "lucide-react";

const ALL_ROLES: Role[] = ["admin", "finance", "production", "sales", "route", "store", "viewer"];

export function SettingsScreen() {
  const { t, lang } = useApp();
  return (
    <AppShell title={t("Mipangilio", "Settings / Admin")}>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t("Watumiaji & majukumu", "Users & roles")}</TabsTrigger>
          <TabsTrigger value="company">{t("Kampuni", "Company")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("Vituo vya arifa", "Alert thresholds")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("Ratiba ya ripoti", "Report schedule")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard label={t("Watumiaji", "Users")} value={USERS.length} accent="green" />
            <StatCard label={t("Wenye majukumu mengi", "Multi-role")} value={USERS.filter((u) => u.roles.length > 1).length} accent="info" />
            <StatCard label={t("Wamesimamishwa", "Disabled")} value={0} accent="amber" />
            <StatCard label={t("Majukumu", "Roles defined")} value={ALL_ROLES.length} accent="green" />
          </div>

          <SectionCard title={t("Watumiaji wa mfumo", "System users")}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2 px-3">{t("Mtumiaji", "User")}</th><th>{t("Barua pepe", "Email")}</th><th>{t("Majukumu (yawezekana mengi)", "Roles (multi)")}</th><th>{t("Hai", "Active")}</th><th /></tr></thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: u.avatarColor }}>{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span className="font-medium">{u.name}</span></div>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{u.email}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => <Pill key={r} tone="success">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</Pill>)}
                      </div>
                    </td>
                    <td className="py-2.5"><Switch defaultChecked={u.active} /></td>
                    <td className="py-2.5 text-right"><AssignRolesDialog name={u.name} current={u.roles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted-foreground">{t("Kumbuka: mtumiaji mmoja anaweza kushikilia majukumu kadhaa kwa wakati mmoja. Admin pekee anaweza kuongeza au kufuta majukumu.", "Note: one user can hold multiple roles at once. Only Admin can assign or revoke roles.")}</div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <SectionCard title={t("Profaili ya kampuni", "Company profile")}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div><Label>{t("Jina la kampuni", "Company name")}</Label><Input defaultValue={COMPANY.name} /></div>
                <div><Label>{t("Eneo", "Location")}</Label><Input defaultValue={COMPANY.city} /></div>
                <div><Label>{t("Simu ya msaada", "Support phone")}</Label><Input defaultValue="+255 754 100 000" /></div>
                <div><Label>{t("Lugha chaguo-msingi", "Default language")}</Label>
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="sw"><option value="sw">Kiswahili</option><option value="en">English</option></select>
                </div>
              </div>
              <div className="space-y-3">
                <div><Label>{t("Ujumbe wa risiti", "Receipt footer")}</Label><Input defaultValue={COMPANY.footer} /></div>
                <div><Label>{t("Sarafu", "Currency")}</Label><Input defaultValue="TZS" /></div>
                <div><Label>{t("Eneo la wakati", "Timezone")}</Label><Input defaultValue="Africa/Dar_es_Salaam" /></div>
                <Button className="mt-2 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Mipangilio imehifadhiwa", "Settings saved"))}>{t("Hifadhi mipangilio", "Save settings")}</Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <SectionCard title={t("Mipaka ya arifa", "Alert thresholds")}>
            <div className="space-y-3 max-w-xl">
              {[
                { label: t("Litre za chini za fresh milk", "Fresh milk low threshold (L)"), v: 100 },
                { label: t("Idadi ya chini ya butter", "Butter low threshold (pcs)"), v: 20 },
                { label: t("Siku za madeni kabla ya arifa", "Days credit aged before warning"), v: 14 },
                { label: t("Asilimia ya juu ya spoilage", "Max spoilage % per day"), v: 3 },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-3"><div className="flex-1 text-sm">{x.label}</div><Input type="number" defaultValue={x.v} className="w-28 font-num text-right" /></div>
              ))}
              <Button className="text-white mt-3" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Mipaka imehifadhiwa", "Thresholds saved"))}>{t("Hifadhi", "Save")}</Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <SectionCard title={t("Wapokeaji wa ripoti otomatiki", "Auto-report recipients")}>
            <p className="text-sm text-muted-foreground mb-3">{t("Tumia ukurasa wa Ripoti kuona ratiba kamili.", "Use the Reports page for the full schedule grid.")}</p>
            <div className="rounded-xl bg-secondary/60 p-3 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#1E7C3F]" /> owner@africanjoy.co.tz — {t("kila siku", "daily")}, {t("kila wiki", "weekly")}, {t("kila mwezi", "monthly")}</div>
              <div className="flex items-center gap-2 mt-2"><Bell className="h-4 w-4 text-[#1E7C3F]" /> WhatsApp +255 754 100 000 — {t("muhtasari wa kila siku", "daily summary")}</div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AssignRolesDialog({ name, current }: { name: string; current: Role[] }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Role[]>(current);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs"><UserCog className="h-3.5 w-3.5 mr-1.5" />{t("Hariri majukumu", "Assign roles")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Majukumu ya", "Roles for")} {name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-xl border border-border p-2.5 cursor-pointer hover:bg-accent">
              <Checkbox checked={sel.includes(r)} onCheckedChange={(c) => setSel((s) => c ? [...s, r] : s.filter((x) => x !== r))} />
              <span className="text-sm font-medium">{lang === "sw" ? ROLE_LABEL[r].sw : ROLE_LABEL[r].en}</span>
            </label>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button><Button onClick={() => { toast.success(t("Majukumu yamehifadhiwa", "Roles saved")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
