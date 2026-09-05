import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { milkCollectionsKeys, milkCollectionsRepo } from "@/lib/data/milkCollections";

export function useMilkCollectionsSummary(from: string, to: string) {
  return useQuery({
    queryKey: milkCollectionsKeys.summary(from, to),
    queryFn: () => milkCollectionsRepo.summary(from, to),
  });
}

export function useMilkBillLines(date: string) {
  return useQuery({
    queryKey: milkCollectionsKeys.billLines(date),
    queryFn: () => milkCollectionsRepo.billLines(date),
  });
}

export function useManualMilkBills(date: string) {
  return useQuery({
    queryKey: milkCollectionsKeys.manualBills(date),
    queryFn: () => milkCollectionsRepo.manualBills(date),
  });
}

export function useRecordManualMilkBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: milkCollectionsRepo.recordManualBill,
    onSuccess: () => qc.invalidateQueries({ queryKey: milkCollectionsKeys.all }),
  });
}

export function useDeleteManualMilkBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => milkCollectionsRepo.deleteManualBill(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: milkCollectionsKeys.all }),
  });
}
