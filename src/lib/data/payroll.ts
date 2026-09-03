import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: payroll. PAYE bands and contribution rates live in tables, not
// in code, because they change with each budget. Every payslip figure comes
// from payroll_* RPCs so the ledger and the payslip handed to an employee
// are computed once, from the same arithmetic.

export interface Employee {
  id: string;
  name: string;
  phone: string;
  jobTitle: string;
  nationalId: string | null;
  tin: string | null;
  nssfNo: string | null;
  grossSalaryTZS: number;
  paymentMethod: "cash" | "mpesa" | "bank";
  site: string | null;
  startDate: string;
  active: boolean;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  grossTZS: number;
  nssfEmployeeTZS: number;
  taxableTZS: number;
  payeTZS: number;
  netTZS: number;
  nssfEmployerTZS: number;
  wcfTZS: number;
  sdlTZS: number;
}

export interface PayrollRun {
  id: string;
  month: string;
  status: "draft" | "posted" | "paid";
  postedAt: string | null;
  paidAt: string | null;
}

interface EmployeeRow {
  id: string;
  name: string;
  phone: string;
  job_title: string;
  national_id: string | null;
  tin: string | null;
  nssf_no: string | null;
  gross_salary_tzs: number;
  payment_method: Employee["paymentMethod"];
  site: string | null;
  start_date: string;
  active: boolean;
}

function toEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    jobTitle: r.job_title,
    nationalId: r.national_id,
    tin: r.tin,
    nssfNo: r.nssf_no,
    grossSalaryTZS: Number(r.gross_salary_tzs),
    paymentMethod: r.payment_method,
    site: r.site,
    startDate: r.start_date,
    active: r.active,
  };
}

export const payrollKeys = {
  all: ["payroll"] as const,
  employees: () => ["payroll", "employees"] as const,
  run: (month: string) => ["payroll", "run", month] as const,
};

export const payrollRepo = {
  async employees(): Promise<Employee[]> {
    const rows = unwrap(
      await supabase.from("employees").select("*").is("deleted_at", null).order("name"),
    ) as EmployeeRow[];
    return rows.map(toEmployee);
  },

  async createEmployee(input: {
    name: string;
    phone: string;
    jobTitle: string;
    grossSalaryTZS: number;
    paymentMethod: "cash" | "mpesa" | "bank";
    nationalId?: string;
    tin?: string;
    nssfNo?: string;
    startDate: string;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("employees")
        .insert({
          name: input.name,
          phone: input.phone,
          job_title: input.jobTitle,
          gross_salary_tzs: input.grossSalaryTZS,
          payment_method: input.paymentMethod,
          national_id: input.nationalId || null,
          tin: input.tin || null,
          nssf_no: input.nssfNo || null,
          start_date: input.startDate,
        })
        .select("id"),
    );
  },

  /** The run for a month plus its payslips, or null if none has been built. */
  async run(month: string): Promise<{ run: PayrollRun; payslips: Payslip[] } | null> {
    const { data: runs, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("month", month)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!runs) return null;
    const r = runs as {
      id: string;
      month: string;
      status: PayrollRun["status"];
      posted_at: string | null;
      paid_at: string | null;
    };
    const slips = unwrap(
      await supabase.from("payslips").select("*").eq("run_id", r.id).order("employee_name"),
    ) as {
      id: string;
      employee_id: string;
      employee_name: string;
      gross_tzs: number;
      nssf_employee_tzs: number;
      taxable_tzs: number;
      paye_tzs: number;
      net_tzs: number;
      nssf_employer_tzs: number;
      wcf_tzs: number;
      sdl_tzs: number;
    }[];
    return {
      run: {
        id: r.id,
        month: r.month,
        status: r.status,
        postedAt: r.posted_at,
        paidAt: r.paid_at,
      },
      payslips: slips.map((s) => ({
        id: s.id,
        employeeId: s.employee_id,
        employeeName: s.employee_name,
        grossTZS: Number(s.gross_tzs),
        nssfEmployeeTZS: Number(s.nssf_employee_tzs),
        taxableTZS: Number(s.taxable_tzs),
        payeTZS: Number(s.paye_tzs),
        netTZS: Number(s.net_tzs),
        nssfEmployerTZS: Number(s.nssf_employer_tzs),
        wcfTZS: Number(s.wcf_tzs),
        sdlTZS: Number(s.sdl_tzs),
      })),
    };
  },

  /** Builds or rebuilds a month's payslips from the active employee list. */
  async createRun(month: string): Promise<{ runId: string; employees: number }> {
    const { data, error } = await supabase.rpc("payroll_create_run", { p_month: month });
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    return { runId: String(r.runId), employees: Number(r.employees ?? 0) };
  },

  async postRun(runId: string): Promise<void> {
    const { error } = await supabase.rpc("payroll_post_run", { p_run_id: runId });
    if (error) throw new Error(error.message);
  },

  async payRun(runId: string, method: "cash" | "mpesa" | "bank"): Promise<void> {
    const { error } = await supabase.rpc("payroll_pay_run", {
      p_run_id: runId,
      p_method: method,
    });
    if (error) throw new Error(error.message);
  },
};
