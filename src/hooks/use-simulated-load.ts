import { useEffect, useState } from "react";

/**
 * Mock-only convenience: simulate a small loading delay on first mount so the
 * skeleton states are visible while the app is still backend-less. Once the
 * Phase E repository layer lands, replace `isLoading` from this hook with
 * `useQuery({…}).isPending` and delete the hook.
 */
export function useSimulatedLoad(ms = 350): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return loading;
}
