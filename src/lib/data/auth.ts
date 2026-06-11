import { supabase, unwrap } from "@/lib/api/client";
import type { Role, User } from "@/mock/types";

// BACKEND: auth + profile repository. The AppProvider is the only consumer;
// screens read the signed-in user via useApp().

export interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  phone: string;
  roles: Role[];
  active: boolean;
  avatar_color: string;
  avatar_url?: string | null;
}

export function profileToUser(p: ProfileRow): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    roles: p.roles,
    active: p.active,
    avatarColor: p.avatar_color,
    avatarUrl: p.avatar_url ?? undefined,
  };
}

async function fetchProfileByAuthId(authUserId: string): Promise<User> {
  const row = unwrap(
    await supabase.from("profiles").select("*").eq("auth_user_id", authUserId).single(),
  ) as ProfileRow;
  if (!row.active) {
    await supabase.auth.signOut();
    throw new Error("account-disabled");
  }
  return profileToUser(row);
}

export const authRepo = {
  /** Real sign-in: password checked by Supabase Auth, profile loaded from the DB. */
  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("invalid-credentials");
    const user = await fetchProfileByAuthId(data.user.id);
    void supabase.rpc("record_audit", {
      p_action: "login",
      p_module: "auth",
      p_sw: "Ameingia kwenye mfumo",
      p_en: "Signed in to the system",
    });
    return user;
  },

  async signOut(): Promise<void> {
    void supabase.rpc("record_audit", {
      p_action: "logout",
      p_module: "auth",
      p_sw: "Ametoka kwenye mfumo",
      p_en: "Signed out of the system",
    });
    await supabase.auth.signOut();
  },

  /** Restores the session on page load. Resolves null when signed out. */
  async restore(): Promise<User | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      return await fetchProfileByAuthId(data.session.user.id);
    } catch {
      return null;
    }
  },
};
