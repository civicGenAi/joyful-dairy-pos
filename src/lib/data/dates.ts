// BACKEND: real dates replace the frozen demo TODAY from @/mock/data.
// The seed script generates the demo dataset relative to the actual current
// date, so screens can safely use the real "today".

const DAY_MS = 86_400_000;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
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
