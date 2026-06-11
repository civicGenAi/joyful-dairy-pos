import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Single Supabase client for the whole app. Repositories in src/lib/data/*
// are the only modules that should import this directly; screens go through
// the react-query hooks in src/lib/data/hooks/*.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_KEY must be set (see .env)");
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "ajd:auth",
  },
});

/**
 * Unwraps a PostgREST response, throwing a typed Error on failure so
 * react-query surfaces it through `error` / `isError`.
 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("not-found");
  return res.data;
}
