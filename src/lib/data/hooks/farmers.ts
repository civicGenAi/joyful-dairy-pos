import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmerAdjustmentsRepo, farmerKeys, farmersRepo } from "@/lib/data/farmers";
import { collectionKeys } from "@/lib/data/collections";

// BACKEND: react-query wrappers for the farmers repository.

export function useFarmers() {
  return useQuery({ queryKey: farmerKeys.list(), queryFn: farmersRepo.list });
}

export function useFarmer(id: string | null) {
  return useQuery({
    queryKey: farmerKeys.byId(id ?? ""),
    queryFn: () => farmersRepo.byId(id!),
    enabled: !!id,
  });
}

export function useCycleSummary() {
  return useQuery({ queryKey: farmerKeys.cycle(), queryFn: farmersRepo.cycleSummary });
}

export function useFarmerMonthlySummary(farmerId: string | null, months = 12) {
  return useQuery({
    queryKey: farmerKeys.monthly(farmerId ?? "", months),
    queryFn: () => farmersRepo.monthlySummary(farmerId!, months),
    enabled: !!farmerId,
  });
}

export function useFarmerPayouts(id: string | null) {
  return useQuery({
    queryKey: farmerKeys.payouts(id ?? ""),
    queryFn: () => farmersRepo.payouts(id!),
    enabled: !!id,
  });
}

export function useCreateFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: farmersRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: farmerKeys.all }),
  });
}

export function useUpdateFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: farmersRepo.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: farmerKeys.all }),
  });
}

export function useDeleteFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => farmersRepo.remove(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: farmerKeys.all }),
  });
}

export function usePayFarmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: farmersRepo.pay,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: farmerKeys.all });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useRecordCollectionInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: farmerKeys.all });
    qc.invalidateQueries({ queryKey: collectionKeys.all });
  };
}

export function useFarmerAdjustments() {
  return useQuery({
    queryKey: farmerKeys.adjustments(),
    queryFn: () => farmerAdjustmentsRepo.list(),
  });
}

export function useRequestAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: farmerAdjustmentsRepo.request,
    onSuccess: () => qc.invalidateQueries({ queryKey: farmerKeys.adjustments() }),
  });
}

export function useReviewAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      farmerAdjustmentsRepo.review(id, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: farmerKeys.all }),
  });
}
