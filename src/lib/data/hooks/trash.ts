import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trashKeys, trashRepo, type TrashEntry } from "@/lib/data/trash";
import { farmerKeys } from "@/lib/data/farmers";
import { customerKeys } from "@/lib/data/customers";
import { productKeys } from "@/lib/data/products";
import { locationKeys } from "@/lib/data/locations";
import { stockKeys } from "@/lib/data/stock";
import { financeKeys } from "@/lib/data/finance";

// BACKEND: react-query wrappers for the trash bin.

export function useTrash() {
  return useQuery({ queryKey: trashKeys.list(), queryFn: trashRepo.list });
}

const LIST_KEYS_BY_ENTITY: Record<TrashEntry["entity"], readonly unknown[]> = {
  farmer: farmerKeys.all,
  customer: customerKeys.all,
  product: productKeys.all,
  location: locationKeys.all,
  "stock-item": stockKeys.all,
  expense: financeKeys.all,
};

export function useRestoreFromTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Pick<TrashEntry, "entity" | "id" | "name">) => trashRepo.restore(entry),
    onSuccess: (_data, entry) => {
      qc.invalidateQueries({ queryKey: trashKeys.all });
      qc.invalidateQueries({ queryKey: LIST_KEYS_BY_ENTITY[entry.entity] });
    },
  });
}

export function usePurgeTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (olderThanDays?: number) => trashRepo.purge(olderThanDays),
    onSuccess: () => qc.invalidateQueries({ queryKey: trashKeys.all }),
  });
}
