import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { packSizeKeys, packSizesRepo } from "@/lib/data/packSizes";

export function usePackSizes() {
  return useQuery({ queryKey: packSizeKeys.all, queryFn: packSizesRepo.listAll });
}

export function useCreatePackSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: packSizesRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: packSizeKeys.all }),
  });
}

export function useDeletePackSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; label: string }) =>
      packSizesRepo.remove(input.id, input.label),
    onSuccess: () => qc.invalidateQueries({ queryKey: packSizeKeys.all }),
  });
}
