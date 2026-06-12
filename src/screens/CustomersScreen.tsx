import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/customers + products (was @/mock/data).
import {
  useCustomers,
  useCustomerActivities,
  useCustomerDeposits,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useRecordCustomerDeposit,
  useSetCustomerSuspended,
  useSendReminder,
} from "@/lib/data/hooks/customers";
import { useProducts } from "@/lib/data/hooks/products";
import { todayISO } from "@/lib/data/dates";
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
import {
  Search,
  FileText,
  Plus,
  UserPlus,
  Send,
  Users,
  Pencil,
  Trash2,
  Mail,
  UserX,
  UserCheck,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Customer, CustomerType } from "@/mock/types";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
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
  const { t, can } = useApp();
  const canWrite = can("customers:write");
  const { data: customers = [], isPending, isError, refetch } = useCustomers();
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

  if (isPending) {
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

  if (isError) {
    return (
      <AppShell title={t("Wateja na Madeni", "Customers & receivables")}>
        <EmptyState
          icon={Users}
          title={t("Imeshindikana kupakia wateja", "Could not load customers")}
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
            {can("customers:write") && <AddCustomerDialog />}
            <ExportMenu
              formats={["excel", "csv", "pdf"]}
              filename="customers"
              data={() => ({
                title: t("Orodha ya wateja", "Customer list"),
                headers: ["Name", "Phone", "Email", "Type", "Outstanding TZS", "Status"],
                rows: filtered.map((c) => [
                  c.name,
                  c.phone,
                  c.email ?? "",
                  c.type,
                  c.outstandingTZS,
                  c.suspended ? "suspended" : c.status,
                ]),
              })}
            />
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
                          {c.nextDueDate && (
                            <div className="text-[10px] text-[#8a5a00]">
                              {t("Malipo", "Due")}: {c.nextDueDate}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.suspended ? (
                            <Pill tone="slate">{t("Amesimamishwa", "Suspended")}</Pill>
                          ) : (
                            <Pill tone={c.status === "overdue" ? "danger" : "success"}>
                              {c.status === "overdue" ? t("Imechelewa", "Overdue") : "OK"}
                            </Pill>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <CustomerDrawer c={c} />
                            {canWrite && <CustomerActions c={c} />}
                          </div>
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

function CustomerDrawer({ c }: { c: Customer }) {
  const { t, can } = useApp();
  const canDeposit = can("deposit:write");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(MONTHS[0].id);
  // BACKEND: activities and deposits are fetched per customer when the drawer opens.
  const { data: activities = [] } = useCustomerActivities(open ? c.id : null);
  const { data: deposits = [] } = useCustomerDeposits(open ? c.id : null);
  const { data: products = [] } = useProducts();
  const totalTakings = activities.reduce((a, x) => a + x.amountTZS, 0);
  const totalDeposits = deposits.reduce((a, x) => a + x.amountTZS, 0);
  const opening = 0;
  const closing = opening + totalTakings - totalDeposits;

  // Real ageing computed from activity dates relative to the real today.
  const buckets = useMemo(() => {
    const result: Record<"current" | "30d" | "60d" | "90+", number> = {
      current: 0,
      "30d": 0,
      "60d": 0,
      "90+": 0,
    };
    const today = todayISO();
    for (const a of activities) {
      if (!a.paid) result[ageOfActivity(a.date, today)] += a.amountTZS;
    }
    const sum = Object.values(result).reduce((a, b) => a + b, 0) || 1;
    return {
      current: Math.round((result.current / sum) * 100),
      "30d": Math.round((result["30d"] / sum) * 100),
      "60d": Math.round((result["60d"] / sum) * 100),
      "90+": Math.round((result["90+"] / sum) * 100),
    };
  }, [activities]);

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
            {activities.length === 0 ? (
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
                  {activities.map((a) => {
                    const p = products.find((x) => x.id === a.productId);
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
              {canDeposit && <RecordDepositDialog customerId={c.id} />}
            </div>
            {deposits.length === 0 ? (
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
                  {deposits.map((d) => (
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

function RecordDepositDialog({ customerId }: { customerId: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(150000);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("cash");
  const [ref, setRef] = useState(`RCT-${1000 + Math.floor(Math.random() * 9000)}`);
  const record = useRecordCustomerDeposit();

  const save = () => {
    if (amount <= 0) return;
    record.mutate(
      { customerId, amountTZS: amount, method, ref },
      {
        onSuccess: () => {
          toast.success(t("Amana imerekodiwa", "Deposit recorded"));
          setOpen(false);
        },
        onError: (e) =>
          toast.error(
            e.message.includes("day-locked")
              ? t("Siku hii imefungwa", "This day is locked")
              : t("Imeshindikana kurekodi amana", "Could not record deposit"),
          ),
      },
    );
  };

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
            <Label>{t("Njia", "Method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={save} disabled={record.isPending}>
            {record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCustomerDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<CustomerType>("cash");
  const [dueDate, setDueDate] = useState("");
  const create = useCreateCustomer();

  const save = () => {
    if (!name.trim()) return;
    create.mutate(
      { name, phone, email, type, nextDueDate: dueDate || undefined },
      {
        onSuccess: () => {
          toast.success(t("Mteja amesajiliwa", "Customer registered"));
          setOpen(false);
          setName("");
          setPhone("");
        },
        onError: () => toast.error(t("Imeshindikana kusajili", "Could not register customer")),
      },
    );
  };

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
          <div className="grid gap-1.5">
            <Label>{t("Barua pepe (kwa vikumbusho)", "Email (for reminders)")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cafe@example.com"
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
          {type !== "cash" && (
            <div className="grid gap-1.5">
              <Label>{t("Tarehe ya malipo (kikumbusho)", "Payment due date (reminder)")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div className="text-[11px] text-muted-foreground">
                {t(
                  "Barua pepe itatumwa siku 5 kabla na siku yenyewe ya malipo.",
                  "An email goes out 5 days before this date and again on the day itself.",
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={save}
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

function CustomerActions({ c }: { c: Customer }) {
  const { t } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone);
  const [email, setEmail] = useState(c.email ?? "");
  const [type, setType] = useState<CustomerType>(c.type);
  const [reminders, setReminders] = useState(c.remindersEnabled ?? true);
  const [dueDate, setDueDate] = useState(c.nextDueDate ?? "");
  const update = useUpdateCustomer();
  const remove = useDeleteCustomer();
  const suspend = useSetCustomerSuspended();
  const sendReminder = useSendReminder();
  const canRemind = c.type !== "cash" && !!(c.email ?? "") && c.outstandingTZS > 0;

  const saveEdit = () => {
    update.mutate(
      {
        id: c.id,
        name,
        phone,
        email,
        type,
        remindersEnabled: reminders,
        nextDueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("Mteja amehifadhiwa", "Customer saved"));
          setEditOpen(false);
        },
        onError: () => toast.error(t("Imeshindikana kuhifadhi", "Could not save customer")),
      },
    );
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        title={t("Hariri", "Edit")}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {canRemind && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={t("Tuma kikumbusho cha deni (barua pepe)", "Send balance reminder (email)")}
          disabled={sendReminder.isPending}
          onClick={() =>
            sendReminder.mutate(c.id, {
              onSuccess: (res) =>
                res.sent[0]?.status === "sent"
                  ? toast.success(t("Kikumbusho kimetumwa", "Reminder sent"))
                  : toast.error(t("Kikumbusho hakikufika", "Reminder failed to send")),
              onError: () =>
                toast.error(
                  t(
                    "Huduma ya barua pepe haijasanidiwa bado",
                    "Email service is not configured yet",
                  ),
                ),
            })
          }
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className={`h-7 w-7 ${c.suspended ? "text-[#1E7C3F]" : "text-muted-foreground"}`}
        title={
          c.suspended
            ? t("Mrudishe mteja", "Reinstate customer")
            : t("Simamisha mteja", "Suspend customer")
        }
        disabled={suspend.isPending}
        onClick={() =>
          suspend.mutate(
            { id: c.id, name: c.name, suspended: !c.suspended },
            {
              onSuccess: () =>
                toast.success(
                  c.suspended
                    ? t("Mteja amerudishwa", "Customer reinstated")
                    : t("Mteja amesimamishwa", "Customer suspended"),
                ),
              onError: () => toast.error(t("Imeshindikana", "Could not update")),
            },
          )
        }
      >
        {c.suspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
      </Button>
      <ConfirmDialog
        destructive
        title={t("Futa mteja?", "Delete customer?")}
        description={t(
          `${c.name} na historia yake ya mauzo itaondolewa kwenye orodha.`,
          `${c.name} will be removed; their sales history links will be detached.`,
        )}
        confirmLabel={t("Futa", "Delete")}
        onConfirm={() =>
          remove.mutate(
            { id: c.id, name: c.name },
            {
              onSuccess: () => toast.success(t("Mteja amefutwa", "Customer deleted")),
              onError: () => toast.error(t("Imeshindikana kufuta", "Could not delete")),
            },
          )
        }
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-[#E11B22]"
            title={t("Futa", "Delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Hariri mteja", "Edit customer")}: {c.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Jina", "Name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Simu", "Phone")}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Aina", "Type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as CustomerType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("Cash", "Cash")}</SelectItem>
                    <SelectItem value="credit">{t("Mkopo", "Credit")}</SelectItem>
                    <SelectItem value="monthly">{t("Mkopo wa mwezi", "Monthly credit")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Barua pepe (kwa vikumbusho)", "Email (for reminders)")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cafe@example.com"
              />
            </div>
            {type !== "cash" && (
              <>
                <div className="grid gap-1.5">
                  <Label>{t("Tarehe ya malipo (kikumbusho)", "Payment due date (reminder)")}</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <div className="text-[11px] text-muted-foreground">
                    {t(
                      "Barua pepe itatumwa siku 5 kabla na siku yenyewe ya malipo.",
                      "An email goes out 5 days before this date and again on the day itself.",
                    )}
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <span>
                    {t("Vikumbusho vya deni otomatiki", "Automatic balance reminders")}
                    <span className="block text-xs text-muted-foreground">
                      {t(
                        "Barua pepe; WhatsApp na SMS zinakuja",
                        "Email; WhatsApp and SMS coming soon",
                      )}
                    </span>
                  </span>
                  <Switch checked={reminders} onCheckedChange={setReminders} />
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("Ghairi", "Cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={update.isPending}>
              {update.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
