import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetKeys, assetsRepo } from "@/lib/data/assets";
import { ledgerKeys } from "@/lib/data/ledger";

// BACKEND: react-query wrappers for the fixed-asset register.

export function useFixedAssets() {
  return useQuery({ queryKey: assetKeys.list(), queryFn: assetsRepo.list });
}

export function useAssetSchedule(month: string) {
  return useQuery({
    queryKey: assetKeys.schedule(month),
    queryFn: () => assetsRepo.schedule(month),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assetsRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

export function usePostDepreciation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => assetsRepo.postDepreciation(month),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assetKeys.all });
      qc.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}
