import { useQuery } from "@tanstack/react-query";
import { catalogKeys, catalogRepo } from "@/lib/data/catalog";

export function usePublicCatalog() {
  return useQuery({ queryKey: catalogKeys.all, queryFn: catalogRepo.list });
}
