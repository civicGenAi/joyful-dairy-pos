export function tzs(n: number, withSuffix = true) {
  const v = Math.round(n).toLocaleString("en-US");
  return withSuffix ? `TZS ${v}` : v;
}
// Whole numbers still render as whole numbers (minimumFractionDigits: 0),
// but a real fractional value (2.5 litres, say) is no longer hard-rounded
// away just because no explicit digit count was passed at the call site.
export function num(n: number, digits?: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits ?? 2,
  });
}
export function L(n: number) {
  return `${num(n)} L`;
}
export function kg(n: number, d = 1) {
  return `${num(n, d)} kg`;
}
