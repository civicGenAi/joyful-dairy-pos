import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  depositKeys,
  depositsRepo,
  saleKeys,
  salesRepo,
  salesDepositCategoriesRepo,
} from "@/lib/data/sales";

// BACKEND: react-query wrappers for sales + deposits.

export function useSalesByDate(date: string, channel?: "counter" | "route") {
  return useQuery({
    queryKey: saleKeys.byDate(date, channel),
    queryFn: () => salesRepo.listByDate(date, channel),
  });
}

export function useSale(id: string | null) {
  return useQuery({
    queryKey: saleKeys.byId(id ?? ""),
    queryFn: () => salesRepo.byId(id!),
    enabled: !!id,
  });
}

export function useCompleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesRepo.complete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesRepo.void,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useDeposits(limit = 50) {
  return useQuery({ queryKey: depositKeys.list(), queryFn: () => depositsRepo.list(limit) });
}

export function useDeposit(id: string | null) {
  return useQuery({
    queryKey: depositKeys.byId(id ?? ""),
    queryFn: () => depositsRepo.byId(id!),
    enabled: !!id,
  });
}

export function useRecordDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: depositsRepo.record,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depositKeys.all });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useDepositsByRange(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: depositKeys.byRange(fromDate, toDate),
    queryFn: () => depositsRepo.listByRange(fromDate, toDate),
  });
}

export function useSalesDepositCategories() {
  return useQuery({
    queryKey: ["salesDepositCategories"],
    queryFn: salesDepositCategoriesRepo.list,
  });
}

export function useCreateSalesDepositCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesDepositCategoriesRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salesDepositCategories"] }),
  });
}

export function useUpdateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: depositsRepo.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depositKeys.all });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useDeleteDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      depositsRepo.remove(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depositKeys.all });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}
