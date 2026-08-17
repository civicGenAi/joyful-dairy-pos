import type { QueryClient } from "@tanstack/react-query";
import { farmerKeys, farmersRepo } from "@/lib/data/farmers";
import { customerKeys, customersRepo } from "@/lib/data/customers";
import { productKeys, productsRepo } from "@/lib/data/products";
import { locationKeys, locationsRepo } from "@/lib/data/locations";
import { stockKeys, stockRepo } from "@/lib/data/stock";
import { financeKeys, expensesRepo } from "@/lib/data/finance";

// BACKEND: hover-prefetch for the sidebar. Warms the query cache for a
// screen's primary list on nav-link hover, so by the time the click lands
// the round trip is often already done and the screen paints from cache
// instead of showing a fresh skeleton every time.

const REFERENCE_STALE_TIME = 5 * 60_000;

type Prefetcher = (qc: QueryClient) => void;

const PREFETCHERS: Record<string, Prefetcher> = {
  "/farmers": (qc) =>
    void qc.prefetchQuery({ queryKey: farmerKeys.list(), queryFn: farmersRepo.list }),
  "/customers": (qc) =>
    void qc.prefetchQuery({ queryKey: customerKeys.list(), queryFn: customersRepo.list }),
  "/pos": (qc) => {
    void qc.prefetchQuery({
      queryKey: productKeys.list(),
      queryFn: productsRepo.list,
      staleTime: REFERENCE_STALE_TIME,
    });
    void qc.prefetchQuery({
      queryKey: productKeys.prices(),
      queryFn: productsRepo.priceMatrix,
      staleTime: REFERENCE_STALE_TIME,
    });
  },
  "/van": (qc) =>
    void qc.prefetchQuery({
      queryKey: productKeys.list(),
      queryFn: productsRepo.list,
      staleTime: REFERENCE_STALE_TIME,
    }),
  "/products": (qc) =>
    void qc.prefetchQuery({
      queryKey: productKeys.list(),
      queryFn: productsRepo.list,
      staleTime: REFERENCE_STALE_TIME,
    }),
  "/stock": (qc) => void qc.prefetchQuery({ queryKey: stockKeys.list(), queryFn: stockRepo.list }),
  "/collection-points": (qc) =>
    void qc.prefetchQuery({ queryKey: farmerKeys.list(), queryFn: farmersRepo.list }),
  "/expenses": (qc) =>
    void qc.prefetchQuery({ queryKey: financeKeys.expenses(), queryFn: () => expensesRepo.list() }),
  "/settings": (qc) =>
    void qc.prefetchQuery({
      queryKey: locationKeys.list(),
      queryFn: locationsRepo.list,
      staleTime: REFERENCE_STALE_TIME,
    }),
};

export function prefetchForRoute(qc: QueryClient, path: string): void {
  PREFETCHERS[path]?.(qc);
}
