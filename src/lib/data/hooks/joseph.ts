import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { josephKeys, josephRepo } from "@/lib/data/joseph";

export function useJosephRates() {
  return useQuery({ queryKey: josephKeys.rates(), queryFn: josephRepo.rates });
}

export function useJosephDailySummary(from: string, to: string) {
  return useQuery({
    queryKey: josephKeys.summary(from, to),
    queryFn: () => josephRepo.dailySummary(from, to),
  });
}

export function useJosephRateBreakdown(from: string, to: string) {
  return useQuery({
    queryKey: josephKeys.breakdown(from, to),
    queryFn: () => josephRepo.rateBreakdown(from, to),
  });
}

export function useJosephSales(from: string, to: string) {
  return useQuery({
    queryKey: josephKeys.sales(from, to),
    queryFn: () => josephRepo.sales(from, to),
  });
}

export function useJosephDeposits(from: string, to: string) {
  return useQuery({
    queryKey: josephKeys.deposits(from, to),
    queryFn: () => josephRepo.deposits(from, to),
  });
}

export function useRecordJosephDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, rates }: { date: string; rates: { rateTZS: number; litres: number }[] }) =>
      josephRepo.recordDay(date, rates),
    onSuccess: () => qc.invalidateQueries({ queryKey: josephKeys.all }),
  });
}

export function useDeleteJosephSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => josephRepo.deleteSale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: josephKeys.all }),
  });
}

export function useRecordJosephDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: josephRepo.recordDeposit,
    onSuccess: () => qc.invalidateQueries({ queryKey: josephKeys.all }),
  });
}

export function useUpdateJosephDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: josephRepo.updateDeposit,
    onSuccess: () => qc.invalidateQueries({ queryKey: josephKeys.all }),
  });
}

export function useDeleteJosephDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => josephRepo.deleteDeposit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: josephKeys.all }),
  });
}
