import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { CUSTOMERS, PRODUCTS } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Wallet, Receipt, FileText, Plus } from "lucide-react";
import type { Customer } from "@/mock/types";
import { ExportMenu } from "@/components/ui/ExportMenu";

export function CustomersScreen() {
  const { t } = useApp();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => CUSTOMERS.filter((c) => {
    if (tab !== "all" && tab === "overdue" ? c.status !== "overdue" : tab !== "all" && c.type !== tab) return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tab, q]);

  const outstanding = CUSTOMERS.reduce((a, c) => a + c.outstandingTZS, 0);
  const overdue = CUSTOMERS.filter((c) => c.status === "overdue").length;

  return (
    <AppShell title={t("Wateja na Madeni", "Customers & receivables")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t("Jumla wateja", "Total customers")} value={num(CUSTOMERS.length)} accent="green" />
        <StatCard label={t("Wateja wa mkopo", "Credit customers")} value={num(CUSTOMERS.filter((c) => c.type !== "cash").length)} accent="info" />
        <StatCard label={t("Madeni jumla", "Outstanding")} value={tzs(outstanding)} accent="amber" />
        <StatCard label={t("Wamechelewa kulipa", "Overdue")} value={num(overdue)} accent="red" />
      </div>

      <SectionCard
        title={t("Orodha ya wateja", "Customer list")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-56 pl-8 text-xs" placeholder={t("Tafuta…", "Search…")} />
            </div>
            <ExportMenu formats={["excel", "csv"]} filename="customers" />
          </div>
        }
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">{t("Wote", "All")}</TabsTrigger>
            <TabsTrigger value="cash">{t("Cash", "Cash")}</TabsTrigger>
            <TabsTrigger value="credit">{t("Mkopo", "Credit")}</TabsTrigger>
            <TabsTrigger value="monthly">{t("Mkopo wa mwezi", "Monthly credit")}</TabsTrigger>
            <TabsTrigger value="overdue">{t("Wamechelewa", "Overdue")}</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-zebra">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Mteja", "Customer")}</th>
                  <th className="py-2 px-3">{t("Aina", "Type")}</th>
                  <th className="py-2 px-3 text-right">{t("Deni", "Outstanding")}</th>
                  <th className="py-2 px-3">{t("Mwisho", "Last activity")}</th>
                  <th className="py-2 px-3">{t("Hali", "Status")}</th>
                  <th />
                </tr></thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      </td>
                      <td className="py-2.5 px-3"><Pill tone={c.type === "cash" ? "info" : c.type === "credit" ? "warning" : "success"}>{c.type === "cash" ? t("Cash", "Cash") : c.type === "credit" ? t("Mkopo", "Credit") : t("Mwezi", "Monthly")}</Pill></td>
                      <td className="py-2.5 px-3 text-right font-num font-semibold">{tzs(c.outstandingTZS)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">{c.lastActivity}</td>
                      <td className="py-2.5 px-3"><Pill tone={c.status === "overdue" ? "danger" : "success"}>{c.status === "overdue" ? t("Imechelewa", "Overdue") : "OK"}</Pill></td>
                      <td className="py-2.5 px-3 text-right"><CustomerDrawer c={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </SectionCard>
    </AppShell>
  );
}

function CustomerDrawer({ c }: { c: Customer }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const totalTakings = (c.monthlyActivity ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const totalDeposits = (c.deposits ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const opening = 0;
  const closing = opening + totalTakings - totalDeposits;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button size="sm" variant="ghost" className="h-7 text-xs">{t("Tazama", "View")}</Button></SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full text-white font-bold" style={{ background: "#1E7C3F" }}>{c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
              <div>
                <div>{c.name}</div>
                <div className="text-xs text-muted-foreground font-normal">{c.phone} · <Pill tone={c.type === "cash" ? "info" : c.type === "credit" ? "warning" : "success"}>{c.type}</Pill></div>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Takings", "Takings")}</div><div className="font-num font-bold">{tzs(totalTakings)}</div></div>
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Amana", "Deposits")}</div><div className="font-num font-bold">{tzs(totalDeposits)}</div></div>
          <div className="rounded-xl bg-secondary/60 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Deni", "Outstanding")}</div><div className="font-num font-bold text-[#E11B22]">{tzs(c.outstandingTZS)}</div></div>
        </div>

        <Tabs defaultValue="activity" className="mt-5">
          <TabsList><TabsTrigger value="activity">{t("Shughuli", "Activity")}</TabsTrigger><TabsTrigger value="statement">{t("Statimenti", "Statement")}</TabsTrigger><TabsTrigger value="deposits">{t("Amana", "Deposits")}</TabsTrigger></TabsList>

          <TabsContent value="activity" className="mt-3">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2">{t("Tarehe", "Date")}</th><th>{t("Bidhaa", "Product")}</th><th className="text-right">{t("Idadi", "Qty")}</th><th className="text-right">{t("Kiasi", "Amount")}</th><th>{t("Hali", "Status")}</th></tr></thead>
              <tbody>{(c.monthlyActivity ?? []).map((a) => { const p = PRODUCTS.find((x) => x.id === a.productId); return (
                <tr key={a.id} className="border-b border-border last:border-0"><td className="py-2 text-xs">{a.date}</td><td className="py-2">{p?.name}</td><td className="py-2 text-right font-num">{a.qty} {a.unit}</td><td className="py-2 text-right font-num font-semibold">{tzs(a.amountTZS)}</td><td className="py-2"><Pill tone={a.paid ? "success" : "warning"}>{a.paid ? t("Imelipwa", "Paid") : t("Mkopo", "Credit")}</Pill></td></tr>
              );})}</tbody>
            </table>
          </TabsContent>

          <TabsContent value="statement" className="mt-3">
            <div className="rounded-xl border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("Statimenti ya mwezi", "Monthly statement")} — May 2026</div>
              <div className="font-display text-lg font-bold mt-1">{c.name}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between border-b border-border py-2"><span>{t("Salio la awali", "Opening balance")}</span><span className="font-num">{tzs(opening)}</span></div>
                <div className="flex justify-between border-b border-border py-2"><span>{t("Manunuzi", "Total takings")}</span><span className="font-num text-[#1E7C3F]">+{tzs(totalTakings)}</span></div>
                <div className="flex justify-between border-b border-border py-2"><span>{t("Amana", "Deposits")}</span><span className="font-num text-[#E11B22]">-{tzs(totalDeposits)}</span></div>
                <div className="flex justify-between border-b border-border py-2 font-bold"><span>{t("Salio la mwisho", "Closing balance")}</span><span className="font-num">{tzs(closing)}</span></div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("Umri wa madeni", "Ageing")}</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[{ l: "Current", v: 50, c: "#2F9E44" }, { l: "30 d", v: 30, c: "#E5A100" }, { l: "60 d", v: 15, c: "#E5A100" }, { l: "90+", v: 5, c: "#E11B22" }].map((x) => (
                    <div key={x.l} className="rounded-lg p-2" style={{ background: `${x.c}15` }}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: x.c }}>{x.l}</div>
                      <div className="font-num font-bold">{x.v}%</div>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="mt-4 text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }} onClick={() => toast.success(t("PDF imepakuliwa", "PDF downloaded"))}><FileText className="h-4 w-4 mr-1.5" />{t("Pakua PDF", "Download PDF")}</Button>
            </div>
          </TabsContent>

          <TabsContent value="deposits" className="mt-3">
            <div className="flex justify-end mb-3"><RecordDepositDialog /></div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-2">{t("Tarehe", "Date")}</th><th>{t("Rejea", "Reference")}</th><th className="text-right">{t("Kiasi", "Amount")}</th></tr></thead>
              <tbody>{(c.deposits ?? []).map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0"><td className="py-2.5 text-xs">{d.date}</td><td className="py-2.5 font-num text-xs">{d.ref}</td><td className="py-2.5 text-right font-num font-semibold">{tzs(d.amountTZS)}</td></tr>
              ))}</tbody>
            </table>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function RecordDepositDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="text-white" style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}><Plus className="h-3.5 w-3.5 mr-1" />{t("Rekodi amana", "Record deposit")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Rekodi amana", "Record deposit")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("Tarehe", "Date")}</Label><Input type="date" defaultValue="2026-05-28" /></div>
          <div className="grid gap-1.5"><Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label><Input type="number" defaultValue={150000} /></div>
          <div className="grid gap-1.5"><Label>{t("Rejea", "Reference")}</Label><Input defaultValue="RCT-1042" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Ghairi", "Cancel")}</Button><Button onClick={() => { toast.success(t("Amana imerekodiwa", "Deposit recorded")); setOpen(false); }}>{t("Hifadhi", "Save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
