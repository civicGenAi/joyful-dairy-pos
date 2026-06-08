import { useCallback, useEffect, useState } from "react";

/**
 * Reactive localStorage-backed state. Falls back to `initial` on the server
 * and when the stored value can't be parsed. Cross-tab sync via the storage
 * event so two tabs stay in step.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const read = (): T => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  };

  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or privacy mode, swallow */
    }
  }, [key, value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue === null ? initial : (JSON.parse(e.newValue) as T));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, initial]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset] as const;
}

/** Detect `prefers-reduced-motion: reduce`, reactive to changes. */
export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefers;
}
