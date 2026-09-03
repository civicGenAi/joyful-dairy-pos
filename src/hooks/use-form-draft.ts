import { useEffect, useRef, useState } from "react";

// Data entry is the expensive part of using this app: a long form lost to a
// closed tab, a dead battery or a stray click is real work gone. Every form
// that opts in keeps a rolling draft in this browser, restores it the next
// time the form opens, and drops it the moment the entry is saved for real.
//
// Drafts are per-browser and per-form, never sent anywhere. Files are not
// (and cannot be) part of a draft, a File can't be serialised, so a chosen
// photo still has to be picked again.

const PREFIX = "ajd:draft:";
const SAVE_DELAY = 400;
// A draft older than this is stale enough that restoring it would be more
// confusing than helpful, e.g. yesterday's half-typed expense reappearing.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

interface Stored<T> {
  at: number;
  value: T;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    // Private mode, blocked storage, corrupt JSON: a draft is a nicety,
    // never let it break the form it is meant to protect.
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable, nothing to clear */
  }
}

/**
 * Keeps `value` in a local draft while `enabled`, restoring once per open.
 *
 * Meant for forms that CREATE something. Deliberately not for edit forms:
 * there the initial values belong to the record being edited, and restoring
 * a draft over them would quietly show one record's numbers while pointing
 * at another.
 */
export function useFormDraft<T extends object>({
  key,
  value,
  onRestore,
  enabled = true,
}: {
  key: string;
  value: T;
  onRestore: (value: T) => void;
  enabled?: boolean;
}) {
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  // Restore runs once per open, never while the user is mid-edit.
  const hasRestored = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasRestored.current = false;
      dirty.current = false;
      setRestored(false);
      return;
    }
    if (hasRestored.current) return;
    hasRestored.current = true;
    const saved = read<T>(key);
    if (saved) {
      restoreRef.current(saved);
      setRestored(true);
    }
  }, [enabled, key]);

  const serialised = JSON.stringify(value);
  useEffect(() => {
    if (!enabled || !hasRestored.current) return;
    // Skip the first pass after opening: that is the form's own initial
    // state (or the draft we just restored), not something worth writing.
    if (!dirty.current) {
      dirty.current = true;
      return;
    }
    const id = setTimeout(() => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
      } catch {
        /* storage full or unavailable, drafts silently stop working */
      }
    }, SAVE_DELAY);
    return () => clearTimeout(id);
    // `serialised` is the real dependency, `value` is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised, enabled, key]);

  return {
    /** True when this open restored a previous draft, for a small notice. */
    restored,
    /** Call after a successful save so the next open starts clean. */
    clear: () => {
      clearDraft(key);
      dirty.current = false;
      setRestored(false);
    },
    /** Dismisses the restored notice without touching the stored draft. */
    acknowledge: () => setRestored(false),
  };
}
