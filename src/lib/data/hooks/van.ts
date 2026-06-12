import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vanKeys, vanRepo } from "@/lib/data/van";

// BACKEND: react-query wrappers for the persisted van loads.

export function useVanLoads(date: string, locationId = "loc-van1") {
  return useQuery({
    queryKey: vanKeys.loads(date, locationId),
    queryFn: () => vanRepo.loads(date, locationId),
  });
}

export function useSaveVanLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: vanRepo.saveLoad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vanKeys.all });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}
