import { firstOfMonth } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import type { Budget, Repo } from "@/lib/db/types";
import { CATEGORIES, SAVINGS_CATEGORY } from "@/lib/finance";

const known = new Set<string>(CATEGORIES);

/**
 * Saves a month's budget. The savings line is always the remainder, so a user
 * edit can never make the limits add up to more than income.
 */
export async function writeBudget(
  repo: Repo,
  userId: string,
  income: number,
  month: string,
  lines: { category: string; limit: number; reason?: string }[],
): Promise<Budget[]> {
  const byCategory = new Map<string, { limit_amount: number; reason: string }>();
  for (const l of lines) {
    if (l.category === SAVINGS_CATEGORY) continue;
    if (!known.has(l.category)) throw new HttpError(400, `Unknown category: ${l.category}`);
    if (!(l.limit >= 0)) throw new HttpError(400, `Limit for ${l.category} must be zero or more.`);
    byCategory.set(l.category, { limit_amount: Math.round(l.limit), reason: l.reason ?? "" });
  }
  const total = [...byCategory.values()].reduce((s, l) => s + l.limit_amount, 0);
  if (total > income) {
    throw new HttpError(400, `Limits add up to ₹${total.toLocaleString("en-IN")}, which is more than your income of ₹${income.toLocaleString("en-IN")}.`);
  }
  const savings = income - total;
  const rate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return repo.replaceBudgets(userId, firstOfMonth(month), [
    ...[...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
    {
      category: SAVINGS_CATEGORY,
      limit_amount: savings,
      reason: `Whatever is left after limits, ${rate}% of income, paid to yourself first.`,
    },
  ]);
}
