import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  expenseCategoriesRepo,
  expenseSitesRepo,
  expensesRepo,
  financeKeys,
  financeRepo,
} from "@/lib/data/finance";

const expenseCategoryKey = ["expenseCategories"] as const;
const expenseSiteKey = ["expenseSites"] as const;

// BACKEND: react-query wrappers for finance + expenses.

export function useCashPosition(date: string) {
  return useQuery({
    queryKey: financeKeys.cash(date),
    queryFn: () => financeRepo.cashPosition(date),
  });
}

export function useInitiatePayouts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (method: "cash" | "mpesa" | "bank") => financeRepo.initiatePayouts(method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farmers"] });
      qc.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
}

export function useExpenses() {
  return useQuery({ queryKey: financeKeys.expenses(), queryFn: () => expensesRepo.list() });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesRepo.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all });
      qc.invalidateQueries({ queryKey: expenseCategoryKey });
      qc.invalidateQueries({ queryKey: expenseSiteKey });
    },
  });
}

export function useExpenseCategories() {
  return useQuery({ queryKey: expenseCategoryKey, queryFn: expenseCategoriesRepo.list });
}

export function useExpenseSites() {
  return useQuery({ queryKey: expenseSiteKey, queryFn: expenseSitesRepo.list });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, vendor }: { id: string; vendor: string }) => expensesRepo.remove(id, vendor),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}
