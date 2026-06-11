import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stockKeys, stockRepo } from "@/lib/data/stock";

// BACKEND: react-query wrappers for stock + the movements ledger.

export function useStock() {
  return useQuery({ queryKey: stockKeys.list(), queryFn: stockRepo.list });
}

export function useStockMovements(limit = 50) {
  return useQuery({
    queryKey: stockKeys.movements(),
    queryFn: () => stockRepo.movements(limit),
  });
}

export function useItemMovements(itemId: string | null) {
  return useQuery({
    queryKey: stockKeys.movements(itemId ?? ""),
    queryFn: () => stockRepo.movementsForItem(itemId!),
    enabled: !!itemId,
  });
}

function useStockInvalidatingMutation<TInput>(fn: (input: TInput) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ["recon"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useStockMove() {
  return useStockInvalidatingMutation(stockRepo.move);
}

export function useRecordSpoilage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockRepo.recordSpoilage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["recon"] });
    },
  });
}

export function useRecordReturn() {
  return useStockInvalidatingMutation(stockRepo.recordReturn);
}

export function useSetReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, reorder }: { id: string; name: string; reorder: number }) =>
      stockRepo.setReorder(id, name, reorder),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockRepo.createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}
