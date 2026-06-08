import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { CUSTOMERS, PRODUCTS, TODAY } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, FileText, Plus, UserPlus, Send, Users } from "lucide-react";
import type { Customer, CustomerType } from "@/mock/types";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { Link } from "@tanstack/react-router";

const MONTHS = [
  { id: "2026-05", label: "May 2026" },
  { id: "2026-04", label: "Apr 2026" },
  { id: "2026-03", label: "Mar 2026" },
  { id: "2026-02", label: "Feb 2026" },
  { id: "2026-01", label: "Jan 2026" },
];

function ageOfActivity(date: string, todayIso: string): "current" | "30d" | "60d" | "90+" {
  const a = new Date(date).getTime();
  const t = new Date(todayIso).getTime();
  const days = Math.floor((t - a) / (1000 * 60 * 60 * 24));
  if (days <= 14) return "current";
  if (days <= 30) return "30d";
  if (days <= 60) return "60d";
  return "90+";
}

export function CustomersScreen() {
  const { t } = useApp();
  const loading = useSimulatedLoad(350);
  const [customers, setCustomers] = useState<Customer[]>(CUSTOMERS);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (tab === "all") return true;
        if (tab === "overdue") return c.status === "overdue";
        return c.type === (tab as CustomerType);
      }),
    [tab, q, customers],
  );

  const outstanding = customers.reduce((a, c) => a + c.outstandingTZS, 0);
  const overdue = customers.filter((c) => c.status === "overdue").length;

  const updateCustomer = (id: string, fn: (c: Customer) => Customer) =>
    setCustomers((xs) => xs.map((c) => (c.id === id ? fn(c) : c)));

  if (loading) {
    return (
      <AppShell title={t("Wateja na Madeni", "Customers & receivables")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={6} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Wateja na Madeni", "Customers & receivables")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Jumla wateja", "Total customers")}
          value={num(customers.length)}
          accent="green"
        />
        <StatCard
          label={t("Wateja wa mkopo", "Credit customers")}
          value={num(customers.filter((c) => c.type !== "cash").length)}
          accent="info"
        />
        <StatCard
          label={t("Madeni jumla", "Outstanding")}
          value={tzs(outstanding)}
          accent="amber"
        />
        <StatCard label={t("Wamechelewa kulipa", "Overdue")} value={num(overdue)} accent="red" />
      </div>

      <SectionCard
        title={t("Orodha ya wateja", "Customer list")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
                placeholder={t("Tafuta…", "Search…")}
              />
            </div>
            <AddCustomerDialog onAdd={(c) => setCustomers((xs) => [c, ...xs])} />
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
            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("Hakuna wateja kwenye kichujio hiki", "No customers in this view")}
                description={t(
                  "Jaribu kichujio kingine au ongeza mteja mpya.",
                  "Try another filter or add a new customer.",
                )}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-zebra">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Mteja", "Customer")}</th>
                      <th className="py-2 px-3">{t("Aina", "Type")}</th>
                      <th className="py-2 px-3 text-right">{t("Deni", "Outstanding")}</th>
                      <th className="py-2 px-3">{t("Mwisho", "Last activity")}</th>
                      <th className="py-2 px-3">{t("Hali", "Status")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Pill
                            tone={
                              c.type === "cash"
                                ? "info"
                                : c.type === "credit"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {c.type === "cash"
                              ? t("Cash", "Cash")
                              : c.type === "credit"
                                ? t("Mkopo", "Credit")
                                : t("Mwezi", "Monthly")}
                          </Pill>
                        </td>
                        <td className="py-2.5 px-3 text-right font-num font-semibold">
                          {tzs(c.outstandingTZS)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">
                          {c.lastActivity}
                        </td>
                        <td className="py-2.5 px-3">
                          <Pill tone={c.status === "overdue" ? "danger" : "success"}>
                            {c.status === "overdue" ? t("Imechelewa", "Overdue") : "OK"}
                          </Pill>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <CustomerDrawer c={c} onUpdate={(fn) => updateCustomer(c.id, fn)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SectionCard>
    </AppShell>
  );
}

function CustomerDrawer({
  c,
  onUpdate,
}: {
  c: Customer;
  onUpdate: (fn: (c: Customer) => Customer) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(MONTHS[0].id);
  const totalTakings = (c.monthlyActivity ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const totalDeposits = (c.deposits ?? []).reduce((a, x) => a + x.amountTZS, 0);
  const opening = 0;
  const closing = opening + totalTakings - totalDeposits;

  // Real ageing computed from activity dates relative to TODAY.
  const buckets = useMemo(() => {
    const result: Record<"current" | "30d" | "60d" | "90+", number> = {
      current: 0,
      "30d": 0,
      "60d": 0,
      "90+": 0,
    };
    for (const a of c.monthlyActivity ?? []) {
      if (!a.paid) result[ageOfActivity(a.date, TODAY)] += a.amountTZS;
    }
    const sum = Object.values(result).reduce((a, b) => a + b, 0) || 1;
    return {
      current: Math.round((result.current / sum) * 100),
      "30d": Math.round((result["30d"] / sum) * 100),
      "60d": Math.round((result["60d"] / sum) * 100),
      "90+": Math.round((result["90+"] / sum) * 100),
    };
  }, [c]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          {t("Tazama", "View")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <div className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-white font-bold"
                style={{ background: "#1E7C3F" }}
              >
                {c.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <div>{c.name}</div>
                <div className="text-xs text-muted-foreground font-normal flex items-center gap-2">
                  {c.phone}{" "}
                  <Pill
                    tone={c.type === "cash" ? "info" : c.type === "credit" ? "warning" : "success"}
                  >
                    {c.type}
                  </Pill>
                </div>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Takings", "Takings")}
            </div>
            <div className="font-num font-bold">{tzs(totalTakings)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Amana", "Deposits")}
            </div>
            <div className="font-num font-bold">{tzs(totalDeposits)}</div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("Deni", "Outstanding")}
            </div>
            <div className="font-num font-bold text-[#E11B22]">{tzs(c.outstandingTZS)}</div>
          </div>
        </div>

        <Tabs defaultValue="activity" className="mt-5">
          <TabsList>
            <TabsTrigger value="activity">{t("Shughuli", "Activity")}</TabsTrigger>
            <TabsTrigger value="statement">{t("Statimenti", "Statement")}</TabsTrigger>
            <TabsTrigger value="deposits">{t("Amana", "Deposits")}</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-3">
            {(c.monthlyActivity ?? []).length === 0 ? (
              <EmptyState
                title={t("Hakuna shughuli", "No activity yet")}
                description={t("Manunuzi yatatokea hapa.", "Purchases will show up here.")}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2">{t("Tarehe", "Date")}</th>
                    <th>{t("Bidhaa", "Product")}</th>
                    <th className="text-right">{t("Idadi", "Qty")}</th>
                    <th className="text-right">{t("Kiasi", "Amount")}</th>
                    <th>{t("Hali", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(c.monthlyActivity ?? []).map((a) => {
                    const p = PRODUCTS.find((x) => x.id === a.productId);
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="py-2 text-xs">{a.date}</td>
                        <td className="py-2">{p?.name}</td>
                        <td className="py-2 text-right font-num">
                          {a.qty} {a.unit}
                        </td>
                        <td className="py-2 text-right font-num font-semibold">
                          {tzs(a.amountTZS)}
                        </td>
                        <td className="py-2">
                          <Pill tone={a.paid ? "success" : "warning"}>
                            {a.paid ? t("Imelipwa", "Paid") : t("Mkopo", "Credit")}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="statement" className="mt-3">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("Statimenti ya mwezi", "Monthly statement")}
                </div>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="font-display text-lg font-bold mt-1">{c.name}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between border-b border-border py-2">
                  <span>{t("Salio la awali", "Opening balance")}</span>
                  <span className="font-num">{tzs(opening)}</span>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <span>{t("Manunuzi", "Total takings")}</span>
                  <span className="font-num text-[#1E7C3F]">+{tzs(totalTakings)}</span>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <span>{t("Amana", "Deposits")}</span>
                  <span className="font-num text-[#E11B22]">-{tzs(totalDeposits)}</span>
                </div>
                <div className="flex justify-between border-b border-border py-2 font-bold">
                  <span>{t("Salio la mwisho", "Closing balance")}</span>
                  <span className="font-num">{tzs(closing)}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t("Umri wa madeni", "Ageing")}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: "Current", v: buckets.current, c: "#2F9E44" },
                    { l: "30 d", v: buckets["30d"], c: "#E5A100" },
                    { l: "60 d", v: buckets["60d"], c: "#E5A100" },
                    { l: "90+", v: buckets["90+"], c: "#E11B22" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg p-2" style={{ background: `${x.c}15` }}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: x.c }}>
                        {x.l}
                      </div>
                      <div className="font-num font-bold">{x.v}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  asChild
                  className="text-white"
                  style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                >
                  <Link
                    to="/statement/customer/$id"
                    params={{ id: c.id }}
                    search={{ month: MONTHS.find((m) => m.id === month)?.label ?? "" }}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    {t("Fungua kwa kuchapisha", "Open print view")}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.success(
                      t("Statimenti imetumwa kwa WhatsApp", "Statement sent via WhatsApp"),
                    )
                  }
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {t("Tuma WhatsApp", "Send WhatsApp")}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deposits" className="mt-3">
            <div className="flex justify-end mb-3">
              <RecordDepositDialog
                onSave={(d) => {
                  onUpdate((cust) => ({
                    ...cust,
                    deposits: [...(cust.deposits ?? []), d],
                    outstandingTZS: Math.max(0, cust.outstandingTZS - d.amountTZS),
                  }));
                  toast.success(t("Amana imerekodiwa", "Deposit recorded"));
                }}
              />
            </div>
            {(c.deposits ?? []).length === 0 ? (
              <EmptyState
                title={t("Hakuna amana bado", "No deposits yet")}
                description={t("Bonyeza Rekodi amana kuanza.", "Click Record deposit to begin.")}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2">{t("Tarehe", "Date")}</th>
                    <th>{t("Rejea", "Reference")}</th>
                    <th className="text-right">{t("Kiasi", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(c.deposits ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 text-xs">{d.date}</td>
                      <td className="py-2.5 font-num text-xs">{d.ref}</td>
                      <td className="py-2.5 text-right font-num font-semibold">
                        {tzs(d.amountTZS)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function RecordDepositDialog({
  onSave,
}: {
  onSave: (d: { id: string; date: string; amountTZS: number; ref: string }) => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(TODAY);
  const [amount, setAmount] = useState(150000);
  const [ref, setRef] = useState(`RCT-${1000 + Math.floor(Math.random() * 9000)}`);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Rekodi amana", "Record deposit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rekodi amana", "Record deposit")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Tarehe", "Date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Rejea", "Reference")}</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave({ id: `d-${Date.now()}`, date, amountTZS: amount, ref });
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

function AddCustomerDialog({ onAdd }: { onAdd: (c: Customer) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<CustomerType>("cash");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <UserPlus className="h-3.5 w-3.5 mr-1" /> {t("Mteja mpya", "Add customer")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Sajili mteja mpya", "Register a new customer")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina", "Name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nyumbani Cafe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Simu", "Phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 78x xxx xxx"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Aina", "Type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as CustomerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                  <SelectItem value="credit">
                    {t("Mkopo (per-sale)", "Credit (per-sale)")}
                  </SelectItem>
                  <SelectItem value="monthly">{t("Mkopo wa mwezi", "Monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                id: `c-new-${Date.now()}`,
                name,
                phone,
                type,
                outstandingTZS: 0,
                lastActivity: TODAY,
                status: "ok",
                monthlyActivity: [],
                deposits: [],
              });
              toast.success(t("Mteja amesajiliwa", "Customer registered"));
              setOpen(false);
              setName("");
              setPhone("");
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
