import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollKeys, payrollRepo } from "@/lib/data/payroll";
import { ledgerKeys } from "@/lib/data/ledger";

// BACKEND: react-query wrappers for payroll.

export function useEmployees() {
  return useQuery({ queryKey: payrollKeys.employees(), queryFn: payrollRepo.employees });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollRepo.createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}

export function usePayrollRun(month: string) {
  return useQuery({ queryKey: payrollKeys.run(month), queryFn: () => payrollRepo.run(month) });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => payrollRepo.createRun(month),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}

export function usePostPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => payrollRepo.postRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.all });
      qc.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}

export function usePayPayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, method }: { runId: string; method: "cash" | "mpesa" | "bank" }) =>
      payrollRepo.payRun(runId, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.all });
      qc.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}
