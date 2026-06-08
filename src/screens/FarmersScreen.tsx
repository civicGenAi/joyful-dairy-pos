import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { FARMERS } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, L, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Phone, MapPin, Calendar, Wallet } from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { RowActions } from "@/components/ui/RowActions";
import type { Farmer } from "@/mock/types";

export function FarmersScreen() {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [farmers, setFarmers] = useState<Farmer[]>(FARMERS);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const filtered = useMemo(() => farmers.filter((f) => {
    if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter !== "all" && f.status !== filter) return false;
    return true;
  }), [q, filter, farmers]);

  const totalLitres = farmers.reduce((a, f) => a + f.litresThisCycle, 0);
  const totalDue = farmers.reduce((a, f) => a + f.currentBalanceTZS, 0);
  const totalFarmers = farmers.length;
  const dueCount = farmers.filter((f) => f.status === "due" || f.status === "delayed").length;

  return (
    <AppShell title={t("Wafugaji", "Farmers")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Jumla wafugaji", "Total farmers")} value={num(totalFarmers)} accent="green" />
        <StatCard label={t("Litre mzunguko huu", "Litres this cycle")} value={L(totalLitres)} accent="info" />
        <StatCard label={t("Inadaiwa kulipwa", "Payable now")} value={tzs(totalDue)} accent="amber" />
        <StatCard label={t("Wanaodai", "Awaiting payment")} value={num(dueCount)} accent="red" />
      </div>

      <SectionCard
        title={t("Orodha ya wafugaji", "Farmer list")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 pl-8 text-xs" placeholder={t("Tafuta jina…", "Search name…")} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Wote", "All")}</SelectItem>
                <SelectItem value="active">{t("Wanaoendelea", "Active")}</SelectItem>
                <SelectItem value="due">{t("Wanaodai", "Due")}</SelectItem>
                <SelectItem value="delayed">{t("Wamechelewa", "Delayed")}</SelectItem>
                <SelectItem value="paid">{t("Wamelipwa", "Paid")}</SelectItem>
              </SelectContent>
            </Select>
            <ExportMenu formats={["excel", "csv", "pdf"]} filename="farmers" />
            <RecordCollectionDialog />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-zebra">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th>
                <th className="py-2 px-3">{t("Kijiji", "Village")}</th>
                <th className="py-2 px-3 text-right">{t("Litre", "Litres")}</th>
                <th className="py-2 px-3 text-right">TZS/L</th>
                <th className="py-2 px-3 text-right">{t("Inadaiwa", "Balance")}</th>
                <th className="py-2 px-3">{t("Malipo ya mwisho", "Last payment")}</th>
                <th className="py-2 px-3">{t("Hali", "Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {f.phone}</div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{f.village}</td>
                  <td className="py-2.5 px-3 text-right font-num">{num(f.litresThisCycle)}</td>
                  <td className="py-2.5 px-3 text-right font-num">{num(f.ratePerL)}</td>
                  <td className="py-2.5 px-3 text-right font-num font-semibold">{tzs(f.currentBalanceTZS)}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{f.lastPaymentDate}</td>
                  <td className="py-2.5 px-3">
                    <Pill tone={f.status === "delayed" ? "danger" : f.status === "due" ? "warning" : f.status === "paid" ? "success" : "info"}>
                      {f.status === "delayed" ? t("Imechelewa", "Delayed") : f.status === "due" ? t("Inadaiwa", "Due") : f.status === "paid" ? t("Imelipwa", "Paid") : t("Hai", "Active")}
                    </Pill>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <RowActions
                      itemName={f.name}
                      onView={() => setViewingId(f.id)}
                      onEdit={() => toast.success(t("Fomu ya hariri imefunguliwa", "Edit form opened"))}
                      onDelete={() => { setFarmers((xs) => xs.filter((x) => x.id !== f.id)); toast.success(t("Mfugaji amefutwa", "Farmer deleted")); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {viewingId && <FarmerDetailDrawer farmerId={viewingId} open onClose={() => setViewingId(null)} />}

      <div className="mt-5">
        <SectionCard title={t("Mzunguko wa malipo (siku 15)", "Payment cycle (15 days)")}>
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-2">{t("Mzunguko wa sasa", "Current cycle")}: 01 Jun – 15 Jun 2026</div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full brand-gradient" style={{ width: "62%" }} />
              </div>
              <div className="flex justify-between mt-2 text-xs"><span>{t("Siku zilizopita", "Days elapsed")}: 9/15</span><span className="font-num">{tzs(totalDue)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Wamelipwa", "Paid")}</div>
                <div className="font-num font-bold text-lg">{tzs(2150000)}</div>
              </div>
              <div className="rounded-xl bg-secondary/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Wanasubiri", "Pending")}</div>
                <div className="font-num font-bold text-lg">{tzs(2680000)}</div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function RecordCollectionDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-8 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t("Rekodi ukusanyaji", "Record collection")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Rekodi ukusanyaji wa maziwa", "Record milk collection")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Mfugaji", "Farmer")}</Label>
            <Select defaultValue={FARMERS[0].id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FARMERS.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Tarehe", "Date")}</Label><Input type="date" defaultValue="2026-05-28" /></div>
            <div className="grid gap-1.5"><Label>{t("Kipindi", "Session")}</Label>
              <Select defaultValue="morning"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="morning">{t("Asubuhi", "Morning")}</SelectItem><SelectItem value="evening">{t("Jioni", "Evening")}</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("Litre", "Litres")}</Label><Input type="number" defaultValue={32} /></div>
            <div className="grid gap-1.5"><Label>{t("Bei (TZS/L)", "Rate (TZS/L)")}</Label><Input type="number" defaultValue={1200} /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t("Maelezo (hiari)", "Notes (optional)")}</Label><Input placeholder={t("Ubora mzuri", "Good quality")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button>
          <Button onClick={() => { toast.success(t("Ukusanyaji umerekodiwa", "Collection recorded")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FarmerDetailDrawer({ farmerId, open, onClose }: { farmerId: string; open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const f = FARMERS.find((x) => x.id === farmerId)!;
  const days = Array.from({ length: 30 }).map((_, i) => 8 + ((i + farmerId.length) * 7) % 35);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full text-white font-bold" style={{ background: "#1E7C3F" }}>
              {f.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div>
              <div>{f.name}</div>
              <div className="text-xs text-muted-foreground font-normal flex gap-2"><MapPin className="h-3 w-3 inline" />{f.village} · {f.phone}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Mzunguko huu", "This cycle")}</div><div className="font-num font-bold">{L(f.litresThisCycle)}</div></div>
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Inadaiwa", "Balance")}</div><div className="font-num font-bold">{tzs(f.currentBalanceTZS)}</div></div>
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Bei", "Rate")}</div><div className="font-num font-bold">{num(f.ratePerL)}/L</div></div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {t("Ukusanyaji wa mwezi", "Monthly collection")}</div>
          <div className="grid grid-cols-10 gap-1">
            {days.map((d, i) => (
              <div key={i} className="aspect-square rounded-md grid place-items-center text-[10px] font-num font-semibold" style={{ background: `rgba(47,158,68,${0.15 + d / 80})`, color: "#14532D" }}>{d}</div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">{t("Kila kisanduku = litre kwa siku", "Each cell = litres per day")}</div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold mb-2">{t("Historia ya malipo", "Payment history")}</div>
          <ul className="divide-y divide-border text-sm">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex justify-between py-2">
                <div>
                  <div className="font-medium">{t("Malipo ya mzunguko", "Cycle payout")} #{i}</div>
                  <div className="text-xs text-muted-foreground">2026-0{6 - i}-15</div>
                </div>
                <div className="font-num font-semibold">{tzs(420000 + i * 20000)}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex gap-2">
          <Button className="flex-1 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("Malipo yamerekodiwa", "Payment recorded"))}>
            <Wallet className="h-3.5 w-3.5 mr-1.5" /> {t("Rekodi malipo", "Record payment")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
