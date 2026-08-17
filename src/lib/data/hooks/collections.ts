import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collectionKeys, collectionsRepo, transfersRepo } from "@/lib/data/collections";
import { farmerKeys } from "@/lib/data/farmers";

// BACKEND: react-query wrappers for collections + transfers.

export function useCollections(date: string) {
  return useQuery({
    queryKey: collectionKeys.byDate(date),
    queryFn: () => collectionsRepo.listByDate(date),
  });
}

export function useRecordCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: collectionsRepo.record,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: farmerKeys.all });
      qc.invalidateQueries({ queryKey: ["recon"] });
    },
  });
}

export function useRecordCollectionDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: collectionsRepo.recordDay,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: farmerKeys.all });
      qc.invalidateQueries({ queryKey: ["recon"] });
    },
  });
}

export function useTransfers(limit = 20) {
  return useQuery({
    queryKey: collectionKeys.transfers(),
    queryFn: () => transfersRepo.listRecent(limit),
  });
}

export function useRecordTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transfersRepo.record,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.transfers() });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}
