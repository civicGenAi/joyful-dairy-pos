import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stockKeys, stockRepo } from "@/lib/data/stock";

// BACKEND: react-query wrappers for stock + the movements ledger.

export function useStock() {
  return useQuery({ queryKey: stockKeys.list(), queryFn: stockRepo.list });
}

export function useStockMovements(page = 0, pageSize = 50) {
  return useQuery({
    queryKey: stockKeys.movements(undefined, page),
    queryFn: () => stockRepo.movements(pageSize, page * pageSize),
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

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockRepo.createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockRepo.updateItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useSetStockItemActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, active }: { id: string; name: string; active: boolean }) =>
      stockRepo.setItemActive(id, name, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => stockRepo.remove(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useSetReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, reorder }: { id: string; name: string; reorder: number }) =>
      stockRepo.setReorder(id, name, reorder),
    onSuccess: () => qc.invalidateQueries({ queryKey: stockKeys.all }),
  });
}
