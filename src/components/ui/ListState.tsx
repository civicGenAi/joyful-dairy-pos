import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertOctagon, type LucideIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";
import type { ReactNode } from "react";

interface Props<T> {
  data?: T[];
  loading?: boolean;
  error?: { message: string } | null;
  onRetry?: () => void;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children: (data: T[]) => ReactNode;
  /** Skeleton row count when loading. */
  skeletonRows?: number;
}

export function ListState<T>({
  data,
  loading,
  error,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
  skeletonRows = 6,
}: Props<T>) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 px-6">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl text-white mb-3"
          style={{ background: "#E11B22" }}
        >
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="font-display font-semibold">Couldn't load this list</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error.message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children(data)}</>;
}
