import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productKeys, productsRepo } from "@/lib/data/products";

// BACKEND: react-query wrappers for products + prices.

export function useProducts() {
  return useQuery({ queryKey: productKeys.list(), queryFn: productsRepo.list });
}

export function usePriceMatrix() {
  return useQuery({ queryKey: productKeys.prices(), queryFn: productsRepo.priceMatrix });
}

export function usePriceHistory() {
  return useQuery({ queryKey: productKeys.priceHistory(), queryFn: productsRepo.priceHistory });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useSetProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, active }: { id: string; name: string; active: boolean }) =>
      productsRepo.setActive(id, name, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useSetPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsRepo.setPrice,
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
