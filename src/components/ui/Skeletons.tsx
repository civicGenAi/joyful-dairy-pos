import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable skeleton patterns used across the app's loading states. All inherit
 * the existing shimmer from the shadcn Skeleton primitive and respect the
 * brand surface (rounded-2xl cards, hairline borders).
 */

export function KPISkeleton({
  count = 4,
  columns = "grid-cols-2 lg:grid-cols-4",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-3", columns)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl bg-card border border-border shadow-card p-4 overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#1E7C3F] to-[#8CC63F] opacity-30" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24 mt-2" />
          <Skeleton className="h-3 w-32 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      {/* header */}
      <div
        className="grid gap-3 px-3 py-2 border-b border-border"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 px-3 py-3 border-b border-border last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-32" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className={cn("relative w-full", height)}>
      <div className="absolute inset-0 flex items-end gap-1.5 px-2">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-md"
            style={{ height: `${30 + Math.sin(i / 1.6) * 28 + (i % 4) * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ height = "h-32" }: { height?: string }) {
  return (
    <div
      className={cn("rounded-2xl bg-card border border-border shadow-card p-4 space-y-3", height)}
    >
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  );
}

export function ListItemSkeleton({
  rows = 5,
  avatar = false,
}: {
  rows?: number;
  avatar?: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          {avatar && <Skeleton className="h-9 w-9 rounded-full" />}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function SectionSkeleton({
  title = true,
  children,
}: {
  title?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card">
      {title && (
        <div className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-40" />
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Full-screen skeleton scaffold used during route loading / suspense fallback. */
export function ScreenSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <KPISkeleton />
      <SectionSkeleton>
        <TableSkeleton rows={5} cols={5} />
      </SectionSkeleton>
    </div>
  );
}
