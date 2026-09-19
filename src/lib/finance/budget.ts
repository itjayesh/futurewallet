import { CATEGORIES } from "./constants";

export type BudgetLine = { category: string; limit: number; reason: string };
export type FixedCost = { category: string; amount: number };

export const SAVINGS_CATEGORY = "Savings";
const MIN_SAVINGS_RATE = 0.1;

export class InfeasibleBudgetError extends Error {}

const round100Down = (n: number) => Math.floor(n / 100) * 100;

/**
 * Turns the model's proposed limits into a budget the code can vouch for:
 *  - only known categories, limits rounded to ₹100
 *  - fixed costs are a floor for their category
 *  - flexible categories are scaled down so a savings line of at least 10% of
 *    income (or whatever the fixed costs leave) always fits
 *  - the savings line is the remainder, so the total never exceeds income
 */
export function normalizeBudget(
  income: number,
  fixedCosts: FixedCost[],
  proposed: BudgetLine[],
): BudgetLine[] {
  const fixed = new Map<string, number>();
  for (const f of fixedCosts) {
    fixed.set(f.category, (fixed.get(f.category) ?? 0) + Math.max(0, f.amount));
  }
  const fixedTotal = [...fixed.values()].reduce((a, b) => a + b, 0);
  if (fixedTotal > income) {
    throw new InfeasibleBudgetError("Fixed costs are higher than income, so no budget can fit.");
  }

  const known = new Set<string>(CATEGORIES);
  const byCategory = new Map<string, BudgetLine>();
  for (const line of proposed) {
    if (!known.has(line.category)) continue;
    byCategory.set(line.category, {
      category: line.category,
      limit: Math.max(0, round100Down(line.limit)),
      reason: line.reason,
    });
  }
  for (const [category, amount] of fixed) {
    const existing = byCategory.get(category);
    byCategory.set(category, {
      category,
      limit: Math.max(existing?.limit ?? 0, Math.ceil(amount)),
      reason: existing?.reason || "Fixed cost you entered.",
    });
  }

  const lines = [...byCategory.values()];
  const isFixed = (l: BudgetLine) => fixed.has(l.category);
  const fixedSum = lines.filter(isFixed).reduce((s, l) => s + l.limit, 0);
  const flexible = lines.filter((l) => !isFixed(l));
  const flexibleSum = flexible.reduce((s, l) => s + l.limit, 0);

  const targetSavings = Math.min(round100Down(income * MIN_SAVINGS_RATE), Math.max(0, income - fixedSum));
  const room = Math.max(0, income - fixedSum - targetSavings);
  if (flexibleSum > room) {
    const factor = flexibleSum === 0 ? 0 : room / flexibleSum;
    for (const l of flexible) l.limit = round100Down(l.limit * factor);
  }

  const spent = lines.reduce((s, l) => s + l.limit, 0);
  const savings = Math.max(0, income - spent);
  const rate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return [
    ...lines,
    {
      category: SAVINGS_CATEGORY,
      limit: savings,
      reason: `Whatever is left after limits, ${rate}% of income, paid to yourself first.`,
    },
  ];
}
