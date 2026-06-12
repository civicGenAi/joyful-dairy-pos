import { supabase } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";

// BACKEND: two-factor authentication (TOTP) on top of Supabase Auth MFA,
// plus the recovery-code RPCs from migration 00007.

export interface EnrollStart {
  factorId: string;
  /** SVG data-URI, ready for an <img src>. */
  qrCode: string;
  /** Manual-entry secret for devices that cannot scan. */
  secret: string;
}

export const mfaKeys = {
  status: () => ["mfa", "status"] as const,
};

/** Generates n human-friendly recovery codes like "X7K2-9QF4-T3MD". */
export function generateRecoveryCodes(n = 8): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    const chars = Array.from(buf, (b) => alphabet[b % alphabet.length]);
    codes.push(
      `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`,
    );
  }
  return codes;
}

/** Downloads the recovery codes as a plain-text file. */
export function downloadRecoveryCodes(codes: string[], email: string) {
  const body = [
    "African Joy Dairy POS, 2FA recovery codes",
    `Account: ${email}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Each code resets two-factor authentication once. Keep them offline and private.",
    "",
    ...codes,
    "",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "african-joy-recovery-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export const mfaRepo = {
  /** Whether the signed-in user has a verified TOTP factor. */
  async status(): Promise<{ enabled: boolean; factorId: string | null }> {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    const verified = data.totp.find((f) => f.status === "verified");
    return { enabled: !!verified, factorId: verified?.id ?? null };
  },

  /**
   * Starts enrolment: creates an unverified TOTP factor and returns the QR
   * code + secret. Any stale unverified factor is cleaned up first so the
   * user can retry the wizard safely.
   */
  async enrollStart(): Promise<EnrollStart> {
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error) throw new Error(error.message);
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  /**
   * Confirms enrolment with a code from the authenticator app, then stores
   * bcrypt hashes of the freshly generated recovery codes server-side.
   */
  async enrollVerify(factorId: string, code: string, recoveryCodes: string[]): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new Error("bad-otp");
    const { error: rpcErr } = await supabase.rpc("store_recovery_codes", {
      p_codes: recoveryCodes,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    await recordAudit(
      "edit",
      "auth",
      "Amewasha uthibitisho wa hatua mbili (2FA)",
      "Enabled two-factor authentication (2FA)",
    );
  },

  /** Cancels an enrolment the user abandoned mid-wizard. */
  async enrollCancel(factorId: string): Promise<void> {
    await supabase.auth.mfa.unenroll({ factorId });
  },

  /** Turns 2FA off: removes the factor and clears the recovery codes. */
  async disable(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(error.message);
    await supabase.rpc("store_recovery_codes", { p_codes: [] });
    await recordAudit(
      "edit",
      "auth",
      "Amezima uthibitisho wa hatua mbili (2FA)",
      "Disabled two-factor authentication (2FA)",
    );
  },

  /** Replaces the recovery codes (old ones stop working). */
  async regenerateRecoveryCodes(recoveryCodes: string[]): Promise<void> {
    const { error } = await supabase.rpc("store_recovery_codes", { p_codes: recoveryCodes });
    if (error) throw new Error(error.message);
    await recordAudit(
      "edit",
      "auth",
      "Ametengeneza namba mpya za uokoaji za 2FA",
      "Generated new 2FA recovery codes",
    );
  },

  /** During sign-in: verifies the 6-digit OTP and upgrades the session to AAL2. */
  async verifyLoginOtp(factorId: string, code: string): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new Error("bad-otp");
  },

  /**
   * During sign-in: burns a recovery code. On success 2FA is reset server-side,
   * so we refresh the session and the AAL2 requirement disappears.
   */
  async useRecoveryCode(code: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("use_recovery_code", {
      p_code: code.trim().toUpperCase(),
    });
    if (error) throw new Error(error.message);
    if (!data) return false;
    await supabase.auth.refreshSession();
    return true;
  },
};
