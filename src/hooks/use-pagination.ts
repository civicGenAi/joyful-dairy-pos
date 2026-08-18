import { useEffect, useMemo, useState } from "react";

/** Paginates an already-filtered array for display. Resets to page 1
 *  whenever the input array itself changes (a new search/filter), but not
 *  when only the page changes, since `items` stays the same reference then. */
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const paged = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return { page, setPage, totalPages, paged, pageSize, total: items.length, start };
}
