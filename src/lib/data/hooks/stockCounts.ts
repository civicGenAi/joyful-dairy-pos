import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stockCountKeys, stockCountsRepo } from "@/lib/data/stockCounts";
import { stockKeys } from "@/lib/data/stock";

export function useStockCountsForDate(date: string) {
  return useQuery({
    queryKey: stockCountKeys.byDate(date),
    queryFn: () => stockCountsRepo.listForDate(date),
  });
}

export function useRecordStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockCountsRepo.record,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockCountKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}
