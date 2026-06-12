import { supabase, unwrap } from "@/lib/api/client";
import type { Role, User } from "@/mock/types";

// BACKEND: auth + profile repository. Sign-in is staged: password first, then
// (when 2FA is on) a TOTP step, then the session-limit gate. The AppProvider
// only marks the user signed-in once every stage has passed.

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

/** True when the session still needs a TOTP code to reach AAL2. */
async function mfaPending(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.nextLevel !== data.currentLevel;
}

export const authRepo = {
  /**
   * Stage 1: password check. Returns the verified TOTP factor id when the
   * account has 2FA enabled (the caller must then run the OTP stage), or
   * null when the password alone is enough.
   */
  async signInPassword(email: string, password: string): Promise<{ mfaFactorId: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("invalid-credentials");
    if (!(await mfaPending())) return { mfaFactorId: null };
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp.find((f) => f.status === "verified");
    return { mfaFactorId: verified?.id ?? null };
  },

  /** Final stage: loads the profile and writes the login audit entry. */
  async completeSignIn(): Promise<User> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("not-signed-in");
    const user = await fetchProfileByAuthId(data.session.user.id);
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

  /**
   * Restores the session on page load. A session that never finished the OTP
   * stage (AAL1 while the account requires AAL2) is discarded: 2FA cannot be
   * skipped with a reload.
   */
  async restore(): Promise<User | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      if (await mfaPending()) {
        await supabase.auth.signOut();
        return null;
      }
      return await fetchProfileByAuthId(data.session.user.id);
    } catch {
      return null;
    }
  },
};
