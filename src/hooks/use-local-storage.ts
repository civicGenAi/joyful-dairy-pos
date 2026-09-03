import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reactive localStorage-backed state. Falls back to `initial` on the server
 * and when the stored value can't be parsed. Cross-tab sync via the storage
 * event so two tabs stay in step.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  // Hydration safety: the server renders `initial`, so the first client
  // render must too. The stored value is applied right after mount;
  // reading it during the initial render causes hydration mismatches
  // (e.g. server "sw" labels against a stored "en" language).
  const [value, setValue] = useState<T>(initial);
  const firstRun = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* unreadable value, keep the default */
    }
  }, [key]);

  useEffect(() => {
    // Skip the mount run: it fires before the stored value lands and
    // would overwrite storage with the default.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
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
