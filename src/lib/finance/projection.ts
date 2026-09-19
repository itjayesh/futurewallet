import { ANNUAL_RETURN } from "./constants";

export type ProjectionPoint = { month: number; balance: number };

/**
 * balance[m] = balance[m-1] * (1 + r/12) + monthlySaving, balance[0] = 0.
 * Returns years * 12 + 1 points (month 0 through the final month).
 */
export function projectBalance(
  monthlySaving: number,
  years: number,
  annualReturn: number = ANNUAL_RETURN,
): ProjectionPoint[] {
  const saving = Math.max(0, monthlySaving);
  const months = Math.round(years * 12);
  const monthlyRate = annualReturn / 12;
  const series: ProjectionPoint[] = [{ month: 0, balance: 0 }];
  let balance = 0;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + saving;
    series.push({ month: m, balance: Math.round(balance * 100) / 100 });
  }
  return series;
}

/**
 * Average of (income - spend) over the given months, floored at 0.
 * `monthlySpend` holds total spend for each of the last N months.
 */
export function averageMonthlySaving(income: number, monthlySpend: number[]): number {
  if (monthlySpend.length === 0) return 0;
  const nets = monthlySpend.map((spend) => income - spend);
  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  return Math.max(0, Math.round(avg * 100) / 100);
}
