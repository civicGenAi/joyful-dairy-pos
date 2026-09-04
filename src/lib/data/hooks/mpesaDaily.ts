import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mpesaKeys,
  mpesaRepo,
  expenseOpeningKeys,
  expenseOpeningRepo,
} from "@/lib/data/mpesaDaily";

export function useMpesaDaily(from: string, to: string) {
  return useQuery({
    queryKey: mpesaKeys.range(from, to),
    queryFn: async () => ({
      entries: await mpesaRepo.list(from, to),
      summary: await mpesaRepo.summary(from, to),
    }),
  });
}

export function useRecordMpesaDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mpesaRepo.record,
    onSuccess: () => qc.invalidateQueries({ queryKey: mpesaKeys.all }),
  });
}

export function useUpdateMpesaDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mpesaRepo.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: mpesaKeys.all }),
  });
}

export function useDeleteMpesaDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mpesaRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: mpesaKeys.all }),
  });
}

export function useExpenseMonthBalance(month: string, site: string) {
  return useQuery({
    queryKey: expenseOpeningKeys.month(month, site),
    queryFn: () => expenseOpeningRepo.balance(month, site),
  });
}

export function useSetExpenseOpening() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      month,
      site,
      amount,
      note,
    }: {
      month: string;
      site: string;
      amount: number;
      note?: string;
    }) => expenseOpeningRepo.set(month, site, amount, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseOpeningKeys.all }),
  });
}
