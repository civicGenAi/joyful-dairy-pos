import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionKeys, productionRepo } from "@/lib/data/production";

// BACKEND: react-query wrappers for production batches + spoilage + yield.

export function useBatches(date: string) {
  return useQuery({
    queryKey: productionKeys.batches(date),
    queryFn: () => productionRepo.batchesByDate(date),
  });
}

export function useSpoilages(date: string) {
  return useQuery({
    queryKey: productionKeys.spoilages(date),
    queryFn: () => productionRepo.spoilagesByDate(date),
  });
}

export function useYieldTrend(days = 7) {
  return useQuery({
    queryKey: productionKeys.yield(days),
    queryFn: () => productionRepo.yieldTrend(days),
  });
}

export function useRecordBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productionRepo.recordBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productionKeys.all });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
    },
  });
}
