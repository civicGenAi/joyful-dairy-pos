export function tzs(n: number, withSuffix = true) {
  const v = Math.round(n).toLocaleString("en-US");
  return withSuffix ? `TZS ${v}` : v;
}
export function num(n: number, digits = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
export function L(n: number) {
  return `${num(n)} L`;
}
export function kg(n: number, d = 1) {
  return `${num(n, d)} kg`;
}
