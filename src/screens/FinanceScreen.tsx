import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
import { CUSTOMERS, FARMERS, TODAY } from "@/mock/data";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { tzs, num } from "@/lib/format";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Wallet,
  Receipt,
  CheckCircle2,
  Calendar,
  Plus,
  FileText,
  Banknote,
  Smartphone,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Link } from "@tanstack/react-router";

interface Deposit {
  id: string;
  time: string;
  ref: string;
  src: string;
  kind: string;
  amount: number;
  method: "cash" | "mpesa" | "bank";
}

const SEED_DEPOSITS: Deposit[] = [
  {
    id: "d1",
    time: "08:15",
    ref: "RCT-5810",
    src: "Route van #1, Baraka",
    kind: "Route cash-up",
    amount: 540000,
    method: "cash",
  },
  {
    id: "d2",
    time: "10:42",
    ref: "RCT-5811",
    src: "Mamis Bistro",
    kind: "Customer deposit",
    amount: 150000,
    method: "mpesa",
  },
  {
    id: "d3",
    time: "12:05",
    ref: "RCT-5812",
    src: "POS, counter",
    kind: "Cash banking",
    amount: 320000,
    method: "cash",
  },
  {
    id: "d4",
    time: "14:30",
    ref: "RCT-5813",
    src: "Jovinary Hotel",
    kind: "Customer deposit",
    amount: 200000,
    method: "bank",
  },
];

const PAYOUTS_QUEUE = [
  {
    date: "2026-05-27",
    by: "Daudi Massawe",
    status: "balanced" as const,
    products: 6,
    balanced: 6,
  },
  {
    date: "2026-05-26",
    by: "Daudi Massawe",
    status: "balanced" as const,
    products: 6,
    balanced: 6,
  },
  {
    date: "2026-05-25",
    by: "Daudi Massawe",
    status: "needs-review" as const,
    products: 6,
    balanced: 5,
  },
];

export function FinanceScreen() {
  const { t, can } = useApp();
  const receivable = CUSTOMERS.reduce((a, c) => a + c.outstandingTZS, 0);
  const payable = FARMERS.reduce((a, f) => a + f.currentBalanceTZS, 0);
  const [deposits, setDeposits] = useState<Deposit[]>(SEED_DEPOSITS);

  const cashPos = deposits.filter((d) => d.method === "cash").reduce((a, d) => a + d.amount, 0);
  const mpesaPos = deposits.filter((d) => d.method === "mpesa").reduce((a, d) => a + d.amount, 0);
  const bankPos = deposits.filter((d) => d.method === "bank").reduce((a, d) => a + d.amount, 0);
  const totalCash = cashPos + mpesaPos + bankPos;

  const ageing = [
    { name: "Current", value: Math.round(receivable * 0.5), color: "#2F9E44" },
    { name: "30 days", value: Math.round(receivable * 0.28), color: "#E5A100" },
    { name: "60 days", value: Math.round(receivable * 0.15), color: "#E5A100" },
    { name: "90+ days", value: Math.round(receivable * 0.07), color: "#E11B22" },
  ];

  return (
    <AppShell title={t("Fedha", "Finance")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Madeni ya wateja", "Receivables")}
          value={tzs(receivable)}
          sub={`${CUSTOMERS.filter((c) => c.outstandingTZS > 0).length} ${t("wateja", "customers")}`}
          accent="amber"
        />
        <StatCard
          label={t("Malipo wafugaji", "Farmer payables")}
          value={tzs(payable)}
          sub={t("Mzunguko 15-siku, 15 Jun", "15-day cycle, Jun 15")}
          accent="info"
        />
        <StatCard
          label={t("Cash leo", "Cash position today")}
          value={tzs(totalCash)}
          sub={`${deposits.length} ${t("risiti", "receipts")}`}
          accent="green"
        />
        <StatCard
          label={t("Amana zilizopokelewa", "Deposits received")}
          value={tzs(totalCash)}
          sub={`Cash · M-Pesa · Bank`}
          accent="green"
        />
      </div>

      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">{t("Madeni", "Receivables")}</TabsTrigger>
          <TabsTrigger value="payables">{t("Malipo wafugaji", "Farmer payables")}</TabsTrigger>
          <TabsTrigger value="deposits">{t("Amana & Risiti", "Deposits & receipts")}</TabsTrigger>
          <TabsTrigger value="cash">{t("Cash position", "Cash position")}</TabsTrigger>
          <TabsTrigger value="dayclose">
            {t("Kuthibitisha siku", "Day-close confirmation")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard
              title={t("Muhtasari wa madeni", "Receivables summary")}
              className="lg:col-span-2"
              action={<ExportMenu formats={["excel", "csv"]} filename="receivables" />}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 px-3">{t("Mteja", "Customer")}</th>
                    <th>{t("Aina", "Type")}</th>
                    <th className="text-right">{t("Deni", "Outstanding")}</th>
                    <th>{t("Hali", "Status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {CUSTOMERS.filter((c) => c.outstandingTZS > 0)
                    .sort((a, b) => b.outstandingTZS - a.outstandingTZS)
                    .slice(0, 10)
                    .map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">{c.name}</td>
                        <td className="py-2.5">
                          <Pill tone={c.type === "monthly" ? "success" : "warning"}>{c.type}</Pill>
                        </td>
                        <td className="py-2.5 text-right font-num font-semibold">
                          {tzs(c.outstandingTZS)}
                        </td>
                        <td className="py-2.5">
                          <Pill tone={c.status === "overdue" ? "danger" : "info"}>
                            {c.status === "overdue" ? t("Imechelewa", "Overdue") : "OK"}
                          </Pill>
                        </td>
                        <td className="py-2.5 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <Link
                              to="/statement/customer/$id"
                              params={{ id: c.id }}
                              search={{ month: "May 2026" }}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              {t("Statimenti", "Statement")}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </SectionCard>
            <SectionCard title={t("Umri wa madeni", "Ageing")}>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={ageing} dataKey="value" innerRadius={45} outerRadius={75}>
                      {ageing.map((a, i) => (
                        <Cell key={i} fill={a.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => tzs(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1 text-xs">
                {ageing.map((a) => (
                  <li key={a.name} className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                      {a.name}
                    </span>
                    <span className="font-num font-semibold">{tzs(a.value)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="payables" className="mt-4">
          <SectionCard
            title={t("Malipo yajayo, mzunguko wa siku 15", "Upcoming payouts, 15-day cycle")}
          >
            <div className="rounded-xl bg-[#1E7C3F]/10 p-4 mb-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#1E7C3F]" />
              <div>
                <div className="font-semibold">
                  {t("Malipo yajayo", "Next payout")}: 15 Jun 2026
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("Wafugaji 15 · Jumla", "15 farmers · Total")}{" "}
                  <span className="font-num font-semibold text-[#14532D]">{tzs(payable)}</span>
                </div>
              </div>
              <InitiatePayoutsDialog />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Mfugaji", "Farmer")}</th>
                  <th className="text-right">{t("Litre", "Litres")}</th>
                  <th className="text-right">{t("Inadaiwa", "Owed")}</th>
                  <th>{t("Hali", "Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {FARMERS.slice(0, 10).map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-medium">{f.name}</td>
                    <td className="py-2.5 text-right font-num">{num(f.litresThisCycle)}</td>
                    <td className="py-2.5 text-right font-num font-semibold">
                      {tzs(f.currentBalanceTZS)}
                    </td>
                    <td className="py-2.5">
                      <Pill
                        tone={
                          f.status === "delayed"
                            ? "danger"
                            : f.status === "due"
                              ? "warning"
                              : "success"
                        }
                      >
                        {f.status}
                      </Pill>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                        <Link to="/statement/farmer/$id" params={{ id: f.id }}>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {t("Statimenti", "Statement")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <SectionCard
            title={t("Amana zilizopokelewa", "Deposits & receipts log")}
            action={
              <div className="flex gap-2">
                <ExportMenu formats={["csv", "excel"]} filename={`deposits-${TODAY}`} />
                {can("deposit:write") && (
                  <RecordReceiptDialog onSave={(d) => setDeposits((xs) => [d, ...xs])} />
                )}
              </div>
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-3">{t("Wakati", "Time")}</th>
                  <th>{t("Rejea", "Reference")}</th>
                  <th>{t("Chanzo", "Source")}</th>
                  <th>{t("Aina", "Type")}</th>
                  <th>{t("Njia", "Method")}</th>
                  <th className="text-right">{t("Kiasi", "Amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">{d.time}</td>
                    <td className="py-2.5 font-num text-xs">{d.ref}</td>
                    <td className="py-2.5 font-medium">{d.src}</td>
                    <td className="py-2.5">
                      <Pill tone="info">{d.kind}</Pill>
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {d.method === "cash" ? (
                          <Banknote className="h-3 w-3" />
                        ) : d.method === "mpesa" ? (
                          <Smartphone className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {d.method}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-num font-semibold">{tzs(d.amount)}</td>
                    <td className="py-2.5 text-right">
                      <Button asChild size="sm" variant="ghost" className="text-xs h-7">
                        <Link to="/receipt/deposit/$id" params={{ id: d.ref }}>
                          <Receipt className="h-3.5 w-3.5 mr-1" />
                          {t("Risiti", "Print")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="cash" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <SectionCard
              title={t("Mgawanyo wa cash leo", "Cash position breakdown")}
              className="lg:col-span-2"
            >
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      { name: "Cash", value: cashPos },
                      { name: "M-Pesa", value: mpesaPos },
                      { name: "Bank", value: bankPos },
                    ]}
                  >
                    <CartesianGrid stroke="#E6EBE1" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B776E" fontSize={11} />
                    <YAxis
                      stroke="#6B776E"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v: number) => tzs(v)} />
                    <Bar dataKey="value" fill="#2F9E44" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={t("Vyanzo vya cash", "Sources")}>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-[#2F9E44]" />
                    Cash
                  </span>
                  <span className="font-num font-semibold">{tzs(cashPos)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#1D9E75]" />
                    M-Pesa
                  </span>
                  <span className="font-num font-semibold">{tzs(mpesaPos)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-[#1E7C3F]" />
                    Bank
                  </span>
                  <span className="font-num font-semibold">{tzs(bankPos)}</span>
                </li>
                <li className="flex justify-between border-t-2 border-border pt-2 font-bold">
                  <span>{t("Jumla", "Total")}</span>
                  <span className="font-num">{tzs(totalCash)}</span>
                </li>
              </ul>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="dayclose" className="mt-4">
          <SectionCard title={t("Kuthibitisha siku", "Day-close confirmation queue")}>
            <ul className="divide-y divide-border">
              {PAYOUTS_QUEUE.map((d) => (
                <li key={d.date} className="flex items-center gap-3 py-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${d.status === "balanced" ? "bg-[#2F9E44]/15 text-[#1E7C3F]" : "bg-[#E5A100]/15 text-[#E5A100]"}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{d.date}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("Imefungwa na", "Locked by")} {d.by} · {d.balanced}/{d.products}{" "}
                      {t("zimesawazi", "balanced")}
                    </div>
                  </div>
                  <Pill tone={d.status === "balanced" ? "success" : "warning"}>
                    {d.status === "balanced"
                      ? t("Imesawazi", "Balanced")
                      : t("Inahitaji ukaguzi", "Needs review")}
                  </Pill>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/report/day-close/$date" params={{ date: d.date }}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      {t("Tazama", "Review")}
                    </Link>
                  </Button>
                  {can("dayclose:confirm") && (
                    <ConfirmDialog
                      title={t("Thibitisha kufunga siku?", "Confirm day close?")}
                      description={t(
                        "Hili linaweka muhuri wa Finance kwenye siku hii.",
                        "This places the Finance seal on this day's books.",
                      )}
                      confirmLabel={t("Thibitisha", "Confirm")}
                      onConfirm={() => toast.success(t("Imethibitishwa", "Confirmed"))}
                      trigger={
                        <Button
                          size="sm"
                          className="text-white"
                          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          {t("Thibitisha", "Confirm")}
                        </Button>
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function RecordReceiptDialog({ onSave }: { onSave: (d: Deposit) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [kind, setKind] = useState("Customer deposit");
  const [amount, setAmount] = useState(100000);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("mpesa");
  const [ref, setRef] = useState(`RCT-${Date.now().toString().slice(-4)}`);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Risiti mpya", "New receipt")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Rekodi risiti / amana", "Record receipt / deposit")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Rejea", "Reference")}</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Aina", "Type")}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer deposit">
                    {t("Amana ya mteja", "Customer deposit")}
                  </SelectItem>
                  <SelectItem value="Route cash-up">
                    {t("Cash ya njia", "Route cash-up")}
                  </SelectItem>
                  <SelectItem value="Cash banking">{t("Cash benki", "Cash banking")}</SelectItem>
                  <SelectItem value="Other">{t("Nyingine", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Chanzo", "Source")}</Label>
            <Input
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="Mamis Bistro"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kiasi (TZS)", "Amount (TZS)")}</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Njia", "Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
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
              onSave({
                id: `d-${Date.now()}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                ref,
                src,
                kind,
                amount,
                method,
              });
              toast.success(t("Imerekodiwa", "Recorded"));
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

function InitiatePayoutsDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState("01–15 Jun 2026");
  const [method, setMethod] = useState("mpesa");
  const total = FARMERS.reduce((a, f) => a + f.currentBalanceTZS, 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="ml-auto text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Wallet className="h-4 w-4 mr-1.5" />
          {t("Anzisha malipo", "Initiate payouts")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Anzisha mzunguko wa malipo", "Initiate payout batch")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl bg-secondary/60 p-3 flex justify-between">
            <span className="text-sm text-muted-foreground">
              {t("Jumla ya malipo", "Total payable")}
            </span>
            <span className="font-num font-bold">{tzs(total)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Mzunguko", "Cycle")}</Label>
            <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Njia", "Method")}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa B2C bulk</SelectItem>
                <SelectItem value="bank">{t("Uhamishaji wa benki", "Bank transfer")}</SelectItem>
                <SelectItem value="cash">{t("Cash mkononi", "Cash in person")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
            {t(
              "Kila mfugaji atapokea risiti kwa SMS, na statimenti kwenye WhatsApp.",
              "Each farmer will get an SMS receipt and a WhatsApp statement on completion.",
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              toast.success(
                t(`Malipo ya ${tzs(total)} yameanzishwa`, `Payouts of ${tzs(total)} initiated`),
              );
              setOpen(false);
            }}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {t("Anzisha", "Initiate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
