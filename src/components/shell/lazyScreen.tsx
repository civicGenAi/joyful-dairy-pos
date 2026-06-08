import { lazy, Suspense, type ComponentType } from "react";
import { ScreenSkeleton } from "@/components/ui/Skeletons";
import { AppShell } from "./AppShell";

/**
 * Wraps a screen module behind React.lazy so it becomes its own Vite chunk.
 * The suspense fallback renders inside the standard AppShell with the
 * ScreenSkeleton, so users see a branded shell during the network blip
 * instead of a blank screen.
 *
 * Usage:
 *   const FarmersScreen = lazyScreen(() => import("@/screens/FarmersScreen"), "FarmersScreen");
 */
export function lazyScreen<P extends object>(
  loader: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
) {
  const Lazy = lazy(async () => {
    const mod = await loader();
    const Component = mod[exportName];
    return { default: Component };
  });
  return function LazyMount(props: P) {
    return (
      <Suspense
        fallback={
          <AppShell title="">
            <ScreenSkeleton />
          </AppShell>
        }
      >
        <Lazy {...props} />
      </Suspense>
    );
  };
}

/**
 * Same as lazyScreen but without AppShell, for standalone screens like
 * the route module and print pages.
 */
export function lazyStandalone<P extends object>(
  loader: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
) {
  const Lazy = lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] };
  });
  return function LazyMount(props: P) {
    return (
      <Suspense
        fallback={
          <div className="grid min-h-screen place-items-center bg-background">
            <div className="h-8 w-8 rounded-full border-2 border-[#1E7C3F] border-t-transparent animate-spin" />
          </div>
        }
      >
        <Lazy {...props} />
      </Suspense>
    );
  };
}
