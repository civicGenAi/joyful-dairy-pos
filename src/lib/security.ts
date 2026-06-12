// Client-side security helpers: the 30-minute idle auto-logout and the
// production lockdown (no context menu / devtools shortcuts) for this
// internal-only system. Real data protection lives server-side in RLS;
// these are workplace-policy deterrents.

export const IDLE_MINUTES = 30;
export const MAX_ACTIVE_SESSIONS = 2;

const LAST_ACTIVITY_KEY = "ajd:last-activity";
/** Set just before the idle logout reload so the login page can explain why. */
export const IDLE_LOGOUT_FLAG = "ajd:idle-logout";

/**
 * Watches user activity (shared across tabs via localStorage) and calls
 * onTimeout once nothing has happened for IDLE_MINUTES. The caller signs
 * out and reloads, which resets every timer and in-memory cache cleanly.
 * Returns a cleanup function.
 */
export function startIdleLogout(onTimeout: () => void): () => void {
  const mark = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  let lastMark = 0;
  // Throttled: high-frequency events (mousemove, scroll) write at most every 5s.
  const onActivity = () => {
    const now = Date.now();
    if (now - lastMark > 5_000) {
      lastMark = now;
      mark();
    }
  };
  mark();

  const events: (keyof WindowEventMap)[] = [
    "pointerdown",
    "keydown",
    "mousemove",
    "scroll",
    "touchstart",
  ];
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

  let fired = false;
  const check = () => {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
    if (!fired && Date.now() - last > IDLE_MINUTES * 60_000) {
      fired = true;
      sessionStorage.setItem(IDLE_LOGOUT_FLAG, "1");
      onTimeout();
    }
  };
  const interval = window.setInterval(check, 15_000);
  // A tab waking from sleep checks immediately instead of waiting a tick.
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearInterval(interval);
    events.forEach((e) => window.removeEventListener(e, onActivity));
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function clearActivityMarker() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

/** True (once) when the last sign-out was caused by the idle timeout. */
export function consumeIdleLogoutFlag(): boolean {
  const v = sessionStorage.getItem(IDLE_LOGOUT_FLAG) === "1";
  sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
  return v;
}

/**
 * Production-only deterrents for an internal system: disables the context
 * menu and the common devtools / view-source shortcuts. This cannot stop a
 * determined person (no client-side trick can); the database RLS and the
 * capability checks are the real boundary.
 */
export function installInspectGuard(): () => void {
  if (!import.meta.env.PROD) return () => {};
  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toUpperCase();
    const blocked =
      k === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C", "K"].includes(k)) ||
      ((e.ctrlKey || e.metaKey) && ["U", "S", "P"].includes(k));
    if (blocked) e.preventDefault();
  };
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("keydown", onKeyDown);
  };
}
