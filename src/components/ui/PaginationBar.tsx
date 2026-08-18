import { useApp } from "@/app/context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  start,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  start: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useApp();
  if (total === 0 || totalPages <= 1) return null;
  const from = start + 1;
  const to = Math.min(start + pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-border">
      <div className="text-xs text-muted-foreground">
        {t(`Inaonyesha ${from}-${to} kati ya ${total}`, `Showing ${from}-${to} of ${total}`)}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-num px-1 min-w-[3.5rem] text-center">
          {page} / {totalPages}
        </span>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
