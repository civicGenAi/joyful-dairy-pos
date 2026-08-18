// BACKEND: real dates replace the frozen demo TODAY from @/mock/data.
// The seed script generates the demo dataset relative to the actual current
// date, so screens can safely use the real "today".

const DAY_MS = 86_400_000;
// Dairy operates in East Africa Time (UTC+3), the browser's own clock/zone
// is irrelevant, so "today" is always the EAT calendar date, computed by
// shifting the epoch forward before truncating to UTC (which then reads as
// the EAT date). Must match the server's `at time zone 'Africa/Nairobi'`.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayISO(): string {
  return new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  return new Date(Date.now() + EAT_OFFSET_MS - days * DAY_MS).toISOString().slice(0, 10);
}

/** "28 May 2026" style label, localised. */
export function dateLabel(iso: string, lang: "sw" | "en" = "en"): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Session suggested by the real clock (EAT): morning until 11:59, then evening. */
export function currentSession(): "morning" | "evening" {
  const hourEAT = (new Date().getUTCHours() + 3) % 24;
  return hourEAT < 12 ? "morning" : "evening";
}
