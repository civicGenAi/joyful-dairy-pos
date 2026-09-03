import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: src/lib/data/payroll. PAYE bands and contribution rates live in
// tables so a budget change is a data edit, not a code change; every figure
// on a payslip is computed server-side by the same function that posts it.
import {
  useEmployees,
  useCreateEmployee,
  usePayrollRun,
  useCreatePayrollRun,
  usePostPayrollRun,
  usePayPayrollRun,
} from "@/lib/data/hooks/payroll";
import { todayISO } from "@/lib/data/dates";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { tzs, num } from "@/lib/format";
import { ChevronLeft, ChevronRight, Plus, Users, Calculator, Send, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function PayrollScreen() {
  const { t, lang, can } = useApp();
  const canWrite = can("finance:write");
  const currentMonth = todayISO().slice(0, 7);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, viewMon] = viewMonth.split("-").map(Number);
  const month = `${viewMonth}-01`;

  const { data: employees = [], isPending } = useEmployees();
  const { data: runData } = usePayrollRun(month);
  const createRun = useCreatePayrollRun();
  const postRun = usePostPayrollRun();
  const payRun = usePayPayrollRun();

  const run = runData?.run;
  const slips = runData?.payslips ?? [];
  const totals = slips.reduce(
    (a, s) => ({
      gross: a.gross + s.grossTZS,
      paye: a.paye + s.payeTZS,
      nssf: a.nssf + s.nssfEmployeeTZS + s.nssfEmployerTZS,
      net: a.net + s.netTZS,
      cost: a.cost + s.grossTZS + s.nssfEmployerTZS + s.wcfTZS + s.sdlTZS,
    }),
    { gross: 0, paye: 0, nssf: 0, net: 0, cost: 0 },
  );

  const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString(
    lang === "sw" ? "sw-TZ" : "en-GB",
    { month: "long", year: "numeric" },
  );
  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMon - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const statusPill =
    run?.status === "paid" ? (
      <Pill tone="success">{t("Imelipwa", "Paid")}</Pill>
    ) : run?.status === "posted" ? (
      <Pill tone="info">{t("Imewekwa vitabuni", "Posted, not yet paid")}</Pill>
    ) : run ? (
      <Pill tone="warning">{t("Rasimu", "Draft")}</Pill>
    ) : null;

  return (
    <AppShell title={t("Mishahara", "Payroll")}>
      <Tabs defaultValue="run">
        <TabsList>
          <TabsTrigger value="run">{t("Mishahara ya mwezi", "Monthly payroll")}</TabsTrigger>
          <TabsTrigger value="staff">{t("Wafanyakazi", "Employees")}</TabsTrigger>
        </TabsList>

        {/* ---- The month's run ---- */}
        <TabsContent value="run" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold w-40 text-center">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={viewMonth >= currentMonth}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {statusPill}
            </div>

            {canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                {(!run || run.status === "draft") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={createRun.isPending || employees.length === 0}
                    onClick={() =>
                      createRun.mutate(month, {
                        onSuccess: (r) =>
                          toast.success(
                            t(
                              `Mishahara ya wafanyakazi ${r.employees} imeandaliwa`,
                              `Prepared payslips for ${r.employees} employees`,
                            ),
                          ),
                        onError: () =>
                          toast.error(t("Imeshindikana kuandaa", "Could not prepare payroll")),
                      })
                    }
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1.5" />
                    {run ? t("Andaa upya", "Recalculate") : t("Andaa mishahara", "Prepare payroll")}
                  </Button>
                )}

                {run?.status === "draft" && slips.length > 0 && (
                  <ConfirmDialog
                    title={t("Weka mishahara vitabuni?", "Post payroll to the ledger?")}
                    description={t(
                      "Baada ya hapa hesabu haziwezi kubadilishwa, kwa sababu tayari zimeingia kwenye vitabu.",
                      "After this the figures are locked, because they will already be in the books.",
                    )}
                    confirmLabel={t("Weka vitabuni", "Post")}
                    onConfirm={() =>
                      postRun.mutate(run.id, {
                        onSuccess: () =>
                          toast.success(t("Imewekwa vitabuni", "Payroll posted to the ledger")),
                        onError: () => toast.error(t("Imeshindikana", "Could not post payroll")),
                      })
                    }
                    trigger={
                      <Button
                        size="sm"
                        className="h-8 text-xs text-white"
                        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        {t("Weka vitabuni", "Post to ledger")}
                      </Button>
                    }
                  />
                )}

                {run?.status === "posted" && (
                  <ConfirmDialog
                    title={t("Thibitisha malipo ya mishahara", "Confirm wages were paid")}
                    description={t(
                      "Hii inaonyesha kuwa mishahara halisi imetoka benki. Kodi na NSSF zinabaki zikidaiwa mpaka zilipwe.",
                      "This records that the net wages actually left the bank. PAYE and NSSF stay owed until they are separately remitted.",
                    )}
                    confirmLabel={t("Ndiyo, imelipwa", "Yes, paid")}
                    onConfirm={() =>
                      payRun.mutate(
                        { runId: run.id, method: "bank" },
                        {
                          onSuccess: () => toast.success(t("Imerekodiwa", "Recorded as paid")),
                          onError: () =>
                            toast.error(t("Imeshindikana", "Could not record the payment")),
                        },
                      )
                    }
                    trigger={
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <Wallet className="h-3.5 w-3.5 mr-1.5" />
                        {t("Rekodi malipo", "Record payment")}
                      </Button>
                    }
                  />
                )}

                {slips.length > 0 && (
                  <ExportMenu
                    formats={["csv", "excel", "pdf"]}
                    filename={`payroll-${viewMonth}`}
                    data={() => ({
                      title: t(`Mishahara, ${monthLabel}`, `Payroll, ${monthLabel}`),
                      headers: [
                        "Employee",
                        "Gross",
                        "NSSF (employee)",
                        "Taxable",
                        "PAYE",
                        "Net pay",
                        "NSSF (employer)",
                        "WCF",
                        "SDL",
                      ],
                      rows: slips.map((s) => [
                        s.employeeName,
                        s.grossTZS,
                        s.nssfEmployeeTZS,
                        s.taxableTZS,
                        s.payeTZS,
                        s.netTZS,
                        s.nssfEmployerTZS,
                        s.wcfTZS,
                        s.sdlTZS,
                      ]),
                    })}
                  />
                )}
              </div>
            )}
          </div>

          {slips.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatCard
                label={t("Mshahara ghafi", "Gross pay")}
                value={tzs(totals.gross)}
                accent="info"
              />
              <StatCard
                label={t("Watakacholipwa", "Net to employees")}
                value={tzs(totals.net)}
                accent="green"
              />
              <StatCard
                label={t("PAYE na NSSF", "PAYE and NSSF owed")}
                value={tzs(totals.paye + totals.nssf)}
                accent="amber"
              />
              <StatCard
                label={t("Gharama halisi kwa biashara", "Real cost to the business")}
                value={tzs(totals.cost)}
                sub={t("Pamoja na mchango wa mwajiri", "Includes the employer's own contributions")}
                accent="red"
              />
            </div>
          )}

          <SectionCard title={t(`Mishahara, ${monthLabel}`, `Payslips, ${monthLabel}`)}>
            {isPending ? (
              <TableSkeleton rows={4} cols={6} />
            ) : employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("Hakuna wafanyakazi bado", "No employees yet")}
                description={t(
                  "Ongeza wafanyakazi kwenye tabo ya Wafanyakazi kwanza.",
                  "Add people on the Employees tab first.",
                )}
              />
            ) : slips.length === 0 ? (
              <EmptyState
                icon={Calculator}
                title={t("Mishahara haijaandaliwa", "Payroll not prepared yet")}
                description={t(
                  "Bonyeza Andaa mishahara kuhesabu kodi na makato ya mwezi huu.",
                  "Use Prepare payroll to work out this month's tax and deductions.",
                )}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Mfanyakazi", "Employee")}</th>
                      <th className="text-right">{t("Ghafi", "Gross")}</th>
                      <th className="text-right">{t("NSSF", "NSSF")}</th>
                      <th className="text-right">{t("Inayotozwa kodi", "Taxable")}</th>
                      <th className="text-right">{t("PAYE", "PAYE")}</th>
                      <th className="text-right px-3">{t("Atakacholipwa", "Net pay")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slips.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">{s.employeeName}</td>
                        <td className="py-2.5 text-right font-num">{tzs(s.grossTZS, false)}</td>
                        <td className="py-2.5 text-right font-num text-muted-foreground">
                          {tzs(s.nssfEmployeeTZS, false)}
                        </td>
                        <td className="py-2.5 text-right font-num text-muted-foreground">
                          {tzs(s.taxableTZS, false)}
                        </td>
                        <td className="py-2.5 text-right font-num text-muted-foreground">
                          {tzs(s.payeTZS, false)}
                        </td>
                        <td className="py-2.5 text-right px-3 font-num font-semibold">
                          {tzs(s.netTZS, false)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2" style={{ borderColor: "#1E6B3A" }}>
                      <td className="py-2.5 px-3 font-bold">{t("Jumla", "Total")}</td>
                      <td className="py-2.5 text-right font-num font-bold">
                        {tzs(totals.gross, false)}
                      </td>
                      <td colSpan={2} />
                      <td className="py-2.5 text-right font-num font-bold">
                        {tzs(totals.paye, false)}
                      </td>
                      <td className="py-2.5 text-right px-3 font-num font-bold">
                        {tzs(totals.net, false)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-[11px] text-muted-foreground">
              {t(
                "Mchango wa NSSF wa mfanyakazi unatolewa kabla ya kodi, ndiyo maana kiasi kinachotozwa kodi ni chini ya mshahara ghafi. Viwango vya kodi vipo kwenye jedwali, vinaweza kubadilishwa vinapobadilika.",
                "The employee's NSSF contribution comes off before tax, which is why taxable pay is below gross. Tax rates live in a table and can be corrected when they change.",
              )}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ---- Employees ---- */}
        <TabsContent value="staff" className="mt-4">
          <SectionCard
            title={t("Wafanyakazi", "Employees")}
            action={canWrite && <AddEmployeeSheet />}
          >
            {isPending ? (
              <TableSkeleton rows={5} cols={4} />
            ) : employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("Hakuna wafanyakazi bado", "No employees yet")}
                description={t("Ongeza mfanyakazi wa kwanza.", "Add your first employee.")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3">{t("Jina", "Name")}</th>
                      <th>{t("Kazi", "Role")}</th>
                      <th>{t("Simu", "Phone")}</th>
                      <th className="text-right px-3">{t("Mshahara", "Gross salary")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3 font-medium">
                          {e.name}
                          {!e.active && (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {t("hafanyi kazi", "inactive")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">{e.jobTitle}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">{e.phone}</td>
                        <td className="py-2.5 text-right px-3 font-num font-semibold">
                          {tzs(e.grossSalaryTZS, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-[11px] text-muted-foreground">
              {num(employees.filter((e) => e.active).length)} {t("wanaofanya kazi", "active")}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AddEmployeeSheet() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [salary, setSalary] = useState(0);
  const [method, setMethod] = useState<"cash" | "mpesa" | "bank">("bank");
  const [tin, setTin] = useState("");
  const [nssfNo, setNssfNo] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const create = useCreateEmployee();

  const save = () => {
    if (!name.trim() || salary <= 0) return;
    create.mutate(
      {
        name,
        phone,
        jobTitle,
        grossSalaryTZS: salary,
        paymentMethod: method,
        tin: tin || undefined,
        nssfNo: nssfNo || undefined,
        startDate,
      },
      {
        onSuccess: () => {
          toast.success(t("Mfanyakazi ameongezwa", "Employee added"));
          setOpen(false);
          setName("");
          setPhone("");
          setJobTitle("");
          setSalary(0);
          setTin("");
          setNssfNo("");
        },
        onError: () => toast.error(t("Imeshindikana kuongeza", "Could not add the employee")),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-white"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("Mfanyakazi mpya", "Add employee")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t("Ongeza mfanyakazi", "Add an employee")}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("Jina kamili", "Full name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Kazi", "Job title")}</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Simu", "Phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("Mshahara ghafi kwa mwezi", "Gross monthly salary")}</Label>
              <Input
                type="number"
                step="any"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="font-num"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Analipwaje", "Paid by")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t("Benki", "Bank")}</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="cash">{t("Fedha taslimu", "Cash")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t("TIN (hiari)", "TIN (optional)")}</Label>
              <Input value={tin} onChange={(e) => setTin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Namba ya NSSF (hiari)", "NSSF number (optional)")}</Label>
              <Input value={nssfNo} onChange={(e) => setNssfNo(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Alianza tarehe", "Start date")}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            {t(
              "Weka mshahara ghafi, kabla ya makato. Mfumo utahesabu NSSF, PAYE na kiasi halisi cha kulipwa.",
              "Enter the gross salary, before deductions. The system works out NSSF, PAYE and what they actually take home.",
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Ghairi", "Cancel")}
          </Button>
          <Button onClick={save} disabled={create.isPending || !name.trim() || salary <= 0}>
            {create.isPending ? t("Inahifadhi…", "Saving…") : t("Hifadhi", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
