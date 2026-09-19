/** ₹1,25,000 style (Indian digit grouping). */
export const inr = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** ₹1.3L / ₹36k, for tight chart axes. */
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${trim(n / 10_000_000)}Cr`;
  if (abs >= 100_000) return `₹${trim(n / 100_000)}L`;
  if (abs >= 1_000) return `₹${trim(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
}
const trim = (n: number) => String(Math.round(n * 10) / 10);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-18" -> "18 Sep 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-09-18" -> "18 Sep" */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "₹1,25,000" or "45000" -> 125000 / 45000. Returns NaN when there is no number. */
export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
