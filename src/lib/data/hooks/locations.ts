import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { locationKeys, locationsRepo } from "@/lib/data/locations";

// BACKEND: react-query wrappers for the locations repository.

// Locations change rarely; a longer staleTime cuts refetches across every
// screen with a location picker (POS, route, collection points, stock).
export function useLocations() {
  return useQuery({
    queryKey: locationKeys.list(),
    queryFn: locationsRepo.list,
    staleTime: 5 * 60_000,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: locationsRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: locationsRepo.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useSetLocationActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, active }: { id: string; name: string; active: boolean }) =>
      locationsRepo.setActive(id, name, active),
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
