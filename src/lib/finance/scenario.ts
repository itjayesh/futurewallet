import { ANNUAL_RETURN } from "./constants";

/** Assumed yearly inflation for "in today's rupees". An assumption, shown to the user. */
export const INFLATION = 0.06;

export interface ScenarioOptions {
  /** Saved every month, starting in month 1. */
  monthlySaving: number;
  years: number;
  /** Assumed annual return as a fraction, e.g. 0.07. */
  annualReturn?: number;
  /** Put in on day one. */
  lumpSum?: number;
  /** The monthly saving grows by this fraction at the start of each new year, e.g. 0.1 for a 10% raise. */
  stepUp?: number;
}

export interface ScenarioPoint {
  month: number;
  balance: number;
  /** Everything the user has put in so far, including the lump sum. */
  contributed: number;
}

/**
 * balance[m] = balance[m-1] * (1 + r/12) + saving(m), balance[0] = lumpSum
 * saving(m) = monthlySaving * (1 + stepUp) ^ floor((m - 1) / 12)
 */
export function projectScenario(o: ScenarioOptions): ScenarioPoint[] {
  const r = (o.annualReturn ?? ANNUAL_RETURN) / 12;
  const base = Math.max(0, o.monthlySaving);
  const lump = Math.max(0, o.lumpSum ?? 0);
  const stepUp = Math.max(0, o.stepUp ?? 0);
  const months = Math.round(o.years * 12);

  const series: ScenarioPoint[] = [{ month: 0, balance: lump, contributed: lump }];
  let balance = lump;
  let contributed = lump;
  for (let m = 1; m <= months; m++) {
    const saving = base * (1 + stepUp) ** Math.floor((m - 1) / 12);
    balance = balance * (1 + r) + saving;
    contributed += saving;
    series.push({ month: m, balance: Math.round(balance * 100) / 100, contributed: Math.round(contributed * 100) / 100 });
  }
  return series;
}

/** Expresses balances in today's purchasing power. Contributions are left as the rupees actually paid in. */
export function inTodaysRupees(series: ScenarioPoint[], inflation: number = INFLATION): ScenarioPoint[] {
  return series.map((p) => ({ ...p, balance: Math.round((p.balance / (1 + inflation) ** (p.month / 12)) * 100) / 100 }));
}

/** First month the balance is at or above the target, or null if it never gets there in this series. */
export function firstMonthAtOrAbove(series: ScenarioPoint[], target: number): number | null {
  if (target <= 0) return 0;
  const hit = series.find((p) => p.balance >= target);
  return hit ? hit.month : null;
}

export interface Milestone {
  id: string;
  title: string;
  target: number;
  kind: "goal" | "standard";
}

/** Nearest, cheapest things first. Standard milestones are skipped when the user already has a goal for them. */
export function buildMilestones(input: {
  goals: { id: string; title: string; target_amount: number; saved_amount: number }[];
  monthlySpend: number;
}): Milestone[] {
  const list: Milestone[] = [];
  for (const g of input.goals) {
    if (g.saved_amount < g.target_amount) list.push({ id: `goal:${g.id}`, title: g.title, target: Math.round(g.target_amount - g.saved_amount), kind: "goal" });
  }
  const has = (word: string) => input.goals.some((g) => g.title.toLowerCase().includes(word));
  if (!has("emergency") && input.monthlySpend > 0) {
    list.push({ id: "emergency", title: "Emergency fund (6 months of spending)", target: Math.round((input.monthlySpend * 6) / 1000) * 1000, kind: "standard" });
  }
  if (!has("bike")) list.push({ id: "bike", title: "A bike (down payment)", target: 150_000, kind: "standard" });
  if (!has("trip")) list.push({ id: "trip", title: "A trip", target: 50_000, kind: "standard" });
  return list.sort((a, b) => a.target - b.target).slice(0, 5);
}
