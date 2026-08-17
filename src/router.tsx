import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Baseline staleTime stops every screen refetching on each mount/window
  // refocus regardless of how volatile the data actually is (react-query's
  // own default is 0, i.e. always stale). Individual hooks for slow-moving
  // reference data (products, locations, prices) set a longer staleTime of
  // their own; this is the floor for everything else.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
