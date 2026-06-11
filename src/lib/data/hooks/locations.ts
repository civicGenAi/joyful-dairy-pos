import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { locationKeys, locationsRepo } from "@/lib/data/locations";

// BACKEND: react-query wrappers for the locations repository.

export function useLocations() {
  return useQuery({ queryKey: locationKeys.list(), queryFn: locationsRepo.list });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: locationsRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => locationsRepo.remove(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}
