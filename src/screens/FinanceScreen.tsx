import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data now flows through src/lib/data/{customers,farmers,sales,finance,recon}.
import { useCustomers } from "@/lib/data/hooks/customers";
import { useFarmers, useCycleSummary } from "@/lib/data/hooks/farmers";
import { useDeposits, useRecordDeposit } from "@/lib/data/hooks/sales";
import { useCashPosition, useInitiatePayouts } from "@/lib/data/hooks/finance";
import { useDayLocks, useConfirmDay } from "@/lib/data/hooks/recon";
import { todayISO, dateLabel } from "@/lib/data/dates";
import { uploadHardCopy } from "@/lib/data/uploads";
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
  Paperclip,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Link } from "@tanstack/react-router";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";

const SOURCE_LABEL: Record<string, { sw: string; en: string }> = {
  customer: { sw: "Amana ya mteja", en: "Customer deposit" },
  route: { sw: "Cash ya njia", en: "Route cash-up" },
  pos: { sw: "Cash benki", en: "Cash banking" },
  other: { sw: "Nyingine", en: "Other" },
};

export function FinanceScreen() {
  const { t } = useApp();
  const today = todayISO();
  const { data: customers = [], isPending } = useCustomers();
  const { data: farmers = [] } = useFarmers();
  const { data: deposits = [] } = useDeposits();
  const { data: cash } = useCashPosition(today);
  const { data: cycle } = useCycleSummary();
  const { data: locks = [] } = useDayLocks();
  const [depositQ, setDepositQ] = useState("");
  const [receiptsOnly, setReceiptsOnly] = useState(false);
  const filteredDeposits = deposits.filter((d) => {
    if (receiptsOnly && !d.attachmentUrl) return false;
    if (!depositQ.trim()) return true;
    const needle = depositQ.toLowerCase();
    return (
      d.id.toLowerCase().includes(needle) ||
      (d.ref ?? "").toLowerCase().includes(needle) ||
      (d.customerName ?? "").toLowerCase().includes(needle) ||
      (d.note ?? "").toLowerCase().includes(needle) ||
      d.source.toLowerCase().includes(needle)
    );
  });
  const confirmDay = useConfirmDay();
  const canConfirm = useApp().can("dayclose:confirm");
  const canDeposit = useApp().can("deposit:write");
  const canPayout = useApp().can("payout:write");

  const receivable = customers.reduce((a, c) => a + c.outstandingTZS, 0);
  const payable = farmers.reduce((a, f) => a + f.currentBalanceTZS, 0);

  const cashPos = deposits.filter((d) => d.method === "cash").reduce((a, d) => a + d.amountTZS, 0);
  const mpesaPos = deposits
    .filter((d) => d.method === "mpesa")
    .reduce((a, d) => a + d.amountTZS, 0);
  const bankPos = deposits.filter((d) => d.method === "bank").reduce((a, d) => a + d.amountTZS, 0);
  const totalCash = cash?.total ?? 0;
  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const ageing = [
    { name: "Current", value: Math.round(receivable * 0.5), color: "#2F9E44" },
    { name: "30 days", value: Math.round(receivable * 0.28), color: "#E5A100" },
    { name: "60 days", value: Math.round(receivable * 0.15), color: "#E5A100" },
    { name: "90+ days", value: Math.round(receivable * 0.07), color: "#E11B22" },
  ];

  if (isPending) {
    return (
      <AppShell title={t("Fedha", "Finance")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={8} cols={5} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Fedha", "Finance")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Madeni ya wateja", "Receivables")}
          value={tzs(receivable)}
          sub={`${customers.filter((c) => c.outstandingTZS > 0).length} ${t("wateja", "customers")}`}
          accent="amber"
        />
        <StatCard
          label={t("Malipo wafugaji", "Farmer payables")}
          value={tzs(payable)}
          sub={
            cycle
              ? t(
                  `Mzunguko wa mwezi, ${dateLabel(cycle.endDate)}`,
                  `Monthly cycle, ${dateLabel(cycle.endDate)}`,
                )
              : t("Hakuna mzunguko wazi", "No open cycle")
          }
          accent="info"
        />
        <StatCard
          label={t("Cash leo", "Cash position today")}
          value={tzs(totalCash)}
          sub={`${deposits.filter((d) => d.date === today).length} ${t("risiti", "receipts")}`}
          accent="green"
        />
        <StatCard
          label={t("Amana zilizopokelewa", "Deposits received")}
          value={tzs(cashPos + mpesaPos + bankPos)}
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
              action={
                <ExportMenu
                  formats={["excel", "csv", "pdf"]}
                  filename="receivables"
                  data={() => ({
                    title: t("Madeni ya wateja", "Customer receivables"),
                    headers: ["Customer", "Type", "Outstanding TZS", "Status"],
                    rows: customers
                      .filter((c) => c.outstandingTZS > 0)
                      .sort((a, b) => b.outstandingTZS - a.outstandingTZS)
                      .map((c) => [c.name, c.type, c.outstandingTZS, c.status]),
                  })}
                />
              }
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
                  {customers
                    .filter((c) => c.outstandingTZS > 0)
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
                              search={{ month: monthLabel }}
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
            title={t("Malipo yajayo, mzunguko wa mwezi", "Upcoming payouts, monthly cycle")}
          >
            <div className="rounded-xl bg-[#1E7C3F]/10 p-4 mb-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#1E7C3F]" />
              <div>
                <div className="font-semibold">
                  {t("Malipo yajayo", "Next payout")}:{" "}
                  {cycle ? dateLabel(cycle.endDate) : t("Haijapangwa", "Not scheduled")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(
                    `Wafugaji ${farmers.filter((f) => f.currentBalanceTZS > 0).length} · Jumla`,
                    `${farmers.filter((f) => f.currentBalanceTZS > 0).length} farmers · Total`,
                  )}{" "}
                  <span className="font-num font-semibold text-[#14532D]">{tzs(payable)}</span>
                </div>
              </div>
              {canPayout && (
                <InitiatePayoutsDialog
                  totalPayable={payable}
                  cycleLabel={
                    cycle ? `${dateLabel(cycle.startDate)} – ${dateLabel(cycle.endDate)}` : ""
                  }
                />
              )}
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
                {farmers
                  .filter((f) => f.currentBalanceTZS > 0)
                  .sort((a, b) => b.currentBalanceTZS - a.currentBalanceTZS)
                  .slice(0, 10)
                  .map((f) => (
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={depositQ}
                    onChange={(e) => setDepositQ(e.target.value)}
                    className="h-8 w-48 pl-8 text-xs"
                    placeholder={t("Tafuta rejea…", "Search reference…")}
                  />
                </div>
                <button
                  onClick={() => setReceiptsOnly((v) => !v)}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${receiptsOnly ? "border-[#1E7C3F] bg-[#1E7C3F]/10 text-[#1E7C3F]" : "border-border text-muted-foreground hover:bg-accent"}`}
                  title={t("Zenye risiti zilizopakiwa tu", "Only deposits with uploaded slips")}
                >
                  <Paperclip className="h-3 w-3" />
                  {t("Zenye risiti", "With receipts")}
                </button>
                <ExportMenu
                  formats={["csv", "excel", "pdf"]}
                  filename={`deposits-${today}`}
                  data={() => ({
                    title: t("Amana na risiti", "Deposits & receipts"),
                    headers: ["Date", "Reference", "Source", "Type", "Method", "Amount TZS"],
                    rows: filteredDeposits.map((d) => [
                      d.date,
                      d.ref ?? d.id,
                      d.customerName ?? d.note ?? "",
                      d.source,
                      d.method,
                      d.amountTZS,
                    ]),
                  })}
                />
                {canDeposit && <RecordReceiptDialog />}
              </div>
            }
          >
            {filteredDeposits.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={
                  receiptsOnly
                    ? t("Hakuna amana zenye risiti", "No deposits with uploaded slips")
                    : t("Hakuna amana bado", "No deposits yet")
                }
              />
            ) : (
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
                  {filteredDeposits.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-3 font-num text-xs text-muted-foreground">
                        {d.date} ·{" "}
                        {new Date(d.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 font-num text-xs">
                        <div className="inline-flex items-center gap-1">
                          {d.ref ?? d.id}
                          {d.attachmentUrl && (
                            <a
                              href={d.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={t("Nakala ngumu", "Hard copy")}
                              className="text-[#1E7C3F] hover:opacity-70"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 font-medium">
                        {d.customerName ?? d.note ?? t("Nyingine", "Other")}
                      </td>
                      <td className="py-2.5">
                        <Pill tone="info">
                          {t(
                            SOURCE_LABEL[d.source]?.sw ?? d.source,
                            SOURCE_LABEL[d.source]?.en ?? d.source,
                          )}
                        </Pill>
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
                      <td className="py-2.5 text-right font-num font-semibold">
                        {tzs(d.amountTZS)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button asChild size="sm" variant="ghost" className="text-xs h-7">
                          <Link to="/receipt/deposit/$id" params={{ id: d.id }}>
                            <Receipt className="h-3.5 w-3.5 mr-1" />
                            {t("Risiti", "Print")}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                  <span className="font-num">{tzs(cashPos + mpesaPos + bankPos)}</span>
                </li>
              </ul>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="dayclose" className="mt-4">
          <SectionCard title={t("Kuthibitisha siku", "Day-close confirmation queue")}>
            {locks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("Hakuna siku zilizofungwa bado", "No locked days yet")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {locks.map((d) => {
                  const confirmed = !!d.confirmedAt;
                  return (
                    <li key={d.date} className="flex items-center gap-3 py-3">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full ${confirmed ? "bg-[#2F9E44]/15 text-[#1E7C3F]" : "bg-[#E5A100]/15 text-[#E5A100]"}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{d.date}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("Imefungwa na", "Locked by")} {d.lockedByName ?? "·"} · {d.rows.length}{" "}
                          {t("bidhaa", "products")}
                        </div>
                      </div>
                      <Pill tone={confirmed ? "success" : "warning"}>
                        {confirmed
                          ? t("Imethibitishwa", "Confirmed")
                          : t("Inasubiri Finance", "Awaiting finance")}
                      </Pill>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/report/day-close/$date" params={{ date: d.date }}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          {t("Tazama", "Review")}
                        </Link>
                      </Button>
                      {canConfirm && !confirmed && (
                        <ConfirmDialog
                          title={t("Thibitisha kufunga siku?", "Confirm day close?")}
                          description={t(
                            "Hili linaweka muhuri wa Finance kwenye siku hii.",
                            "This places the Finance seal on this day's books.",
                          )}
                          confirmLabel={t("Thibitisha", "Confirm")}
                          onConfirm={() =>
                            confirmDay.mutate(d.date, {
                              onSuccess: () => toast.success(t("Imethibitishwa", "Confirmed")),
                              onError: () =>
                                toast.error(t("Imeshindikana kuthibitisha", "Could not confirm")),
                            })
                          }
                          trigger={
                            <Button
                              size="sm"
                              className="text-white"
                              style={{
                                background: "linear-gradient(135deg, #1E7C3F, #8CC63F)",
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              {t("Thibitisha", "Confirm")}
                            </Button>
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function RecordReceiptDialog() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [source, setSource] = useState<"customer" | "route" | "pos" | "other">("customer");
  const [amount, setAmount] = useState(100000);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("mpesa");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const record = useRecordDeposit();

  const save = async () => {
    if (amount <= 0) return;
    setSaving(true);
    try {
      let attachmentUrl: string | undefined;
      if (file) attachmentUrl = await uploadHardCopy(file, "deposit");
      // Reference is generated by the system: AJD-DEP-YYMMDD-sequence.
      record.mutate(
        { source, method, amountTZS: amount, note: src || undefined, attachmentUrl },
        {
          onSuccess: () => {
            toast.success(t("Imerekodiwa", "Recorded"));
            setOpen(false);
            setSrc("");
            setFile(null);
          },
          onError: () => toast.error(t("Imeshindikana kurekodi", "Could not record receipt")),
          onSettled: () => setSaving(false),
        },
      );
    } catch {
      toast.error(t("Imeshindikana kupakia nakala", "Could not upload the hard copy"));
      setSaving(false);
    }
  };

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
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Rejea itatengenezwa na mfumo (AJD-DEP-tarehe-namba) ili iwe rahisi kufuatilia.",
              "The reference is generated by the system (AJD-DEP-date-number) so it is easy to trace.",
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Aina", "Type")}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">
                    {t("Amana ya mteja", "Customer deposit")}
                  </SelectItem>
                  <SelectItem value="route">{t("Cash ya njia", "Route cash-up")}</SelectItem>
                  <SelectItem value="pos">{t("Cash benki", "Cash banking")}</SelectItem>
                  <SelectItem value="other">{t("Nyingine", "Other")}</SelectItem>
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
          <div className="grid gap-1.5">
            <Label>
              {t("Nakala ngumu (hiari, picha au PDF)", "Hard copy (optional, photo or PDF)")}
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {file && <div className="text-[11px] text-muted-foreground">{file.name}</div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={saving || record.isPending}>
            {saving || record.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InitiatePayoutsDialog({
  totalPayable,
  cycleLabel,
}: {
  totalPayable: number;
  cycleLabel: string;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("mpesa");
  const initiate = useInitiatePayouts();

  const save = () => {
    initiate.mutate(method, {
      onSuccess: () => {
        toast.success(
          t(
            `Malipo ya ${tzs(totalPayable)} yameanzishwa`,
            `Payouts of ${tzs(totalPayable)} initiated`,
          ),
        );
        setOpen(false);
      },
      onError: (e) =>
        toast.error(
          e.message.includes("no-open-cycle")
            ? t("Hakuna mzunguko wazi", "No open payout cycle")
            : t("Imeshindikana kuanzisha malipo", "Could not initiate payouts"),
        ),
    });
  };

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
            <span className="font-num font-bold">{tzs(totalPayable)}</span>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Mzunguko", "Cycle")}</Label>
            <Input value={cycleLabel} readOnly />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Njia", "Method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
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
            onClick={save}
            disabled={initiate.isPending}
            className="text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
          >
            {initiate.isPending ? t("Inaanzisha…", "Initiating…") : t("Anzisha", "Initiate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
