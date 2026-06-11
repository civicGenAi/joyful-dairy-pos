import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { User } from "@/mock/types";
import { profileToUser, type ProfileRow } from "@/lib/data/auth";

// BACKEND: self-service profile repository: own details, avatar, password,
// and device sessions. Available to every signed-in user.

export interface DeviceSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

export const profileKeys = {
  all: ["profile"] as const,
  sessions: () => ["profile", "sessions"] as const,
};

/** Reads the current session id out of the access token (sub-claim session_id). */
async function currentSessionId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.session_id as string) ?? null;
  } catch {
    return null;
  }
}

export const profileRepo = {
  /** Update own name / phone / avatar through the audited RPC. */
  async updateOwn(input: { name?: string; phone?: string; avatarUrl?: string }): Promise<User> {
    const { data, error } = await supabase.rpc("update_own_profile", {
      p_name: input.name ?? null,
      p_phone: input.phone ?? null,
      p_avatar_url: input.avatarUrl ?? null,
    });
    if (error) throw new Error(error.message);
    return profileToUser(data as ProfileRow);
  },

  /** Upload an avatar image and store its public URL on the profile. */
  async uploadAvatar(file: File): Promise<User> {
    const { data: me } = await supabase.auth.getUser();
    const uid = me.user?.id;
    if (!uid) throw new Error("not-signed-in");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    return profileRepo.updateOwn({ avatarUrl: pub.publicUrl });
  },

  /**
   * Change own password: re-authenticates with the old password first, and
   * refuses a new password identical to the old one.
   */
  async changeOwnPassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword === oldPassword) throw new Error("same-password");
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });
    if (reauthErr) throw new Error("wrong-old-password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    await recordAudit("edit", "auth", "Amebadilisha nenosiri lake", "Changed their own password");
  },

  /** All device sessions for the signed-in user, newest activity first. */
  async sessions(): Promise<DeviceSession[]> {
    const current = await currentSessionId();
    const { data, error } = await supabase.rpc("my_sessions");
    if (error) throw new Error(error.message);
    const rows = data as {
      id: string;
      created_at: string;
      updated_at: string;
      user_agent: string | null;
      ip: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userAgent: r.user_agent,
      ip: r.ip,
      current: r.id === current,
    }));
  },

  /** Revoke one device session: that device's refresh stops working. */
  async revokeSession(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc("revoke_session", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
  },

  /** Sign out every device except this one. */
  async signOutOtherDevices(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) throw new Error(error.message);
    await recordAudit(
      "logout",
      "auth",
      "Ametoa vifaa vingine vyote kwenye akaunti yake",
      "Signed out all other devices",
    );
  },
};

const SAFE_CHARS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?";

/** A strong random password: 14 chars guaranteed to mix all classes. */
export function generateStrongPassword(): string {
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = Array.from({ length: 10 }, () => pick(SAFE_CHARS));
  base.push(pick("abcdefghijkmnopqrstuvwxyz"));
  base.push(pick("ABCDEFGHJKLMNPQRSTUVWXYZ"));
  base.push(pick("23456789"));
  base.push(pick("!@#$%&*?"));
  return base.sort(() => Math.random() - 0.5).join("");
}

/** 0..4 password strength: length 8+, lower+upper, digit, symbol. */
export function passwordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  return score;
}

/** Short human label for a user-agent string ("Chrome · Windows"). */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ios/i.test(ua)
      ? "iPhone/iPad"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Device";
  return `${browser} · ${os}`;
}
