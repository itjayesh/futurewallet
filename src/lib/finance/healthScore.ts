import { DISCRETIONARY, LATE_NIGHT_HOUR, type Category } from "./constants";

export type ScoreExpense = {
  amount: number;
  category: string;
  spent_at: string | null; // "HH:MM" or "HH:MM:SS"
};

export type ScoreInput = {
  income: number;
  /** Expenses for the month being scored. */
  expenses: ScoreExpense[];
  /** Spend per category this month vs its limit. */
  budgetUsage: { category: string; spent: number; limit: number }[];
  /** Number of goals on track vs total. */
  goals: { onTrack: number; total: number };
  /**
   * Full-month spend to score the savings rate against. Pass it mid-month, when
   * spend so far would make the rate look better than it is. Defaults to this month's total.
   */
  monthlySpendEstimate?: number;
};

export type ScoreComponent = { name: string; points: number; max: number; note: string };

export type HealthScore = {
  score: number;
  components: ScoreComponent[];
  reason: string;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function isLateNight(spentAt: string | null): boolean {
  if (!spentAt) return false;
  const hour = Number(spentAt.slice(0, 2));
  return Number.isFinite(hour) && hour >= LATE_NIGHT_HOUR;
}

export function healthScore(input: ScoreInput): HealthScore {
  const total = input.expenses.reduce((s, e) => s + e.amount, 0);

  // Savings rate: 40 pts, full at >= 20% of income, linear down to 0 at 0%.
  const spendForRate = input.monthlySpendEstimate ?? total;
  const rate = input.income > 0 ? Math.max(0, (input.income - spendForRate) / input.income) : 0;
  const savings: ScoreComponent = {
    name: "Savings rate",
    max: 40,
    points: 40 * clamp(rate / 0.2, 0, 1),
    note: `saving ${Math.round(rate * 100)}% of income (target 20%)`,
  };

  // Budget adherence: 30 pts, loses points in proportion to total overspend vs total limits.
  const totalLimit = input.budgetUsage.reduce((s, b) => s + b.limit, 0);
  const overspend = input.budgetUsage.reduce((s, b) => s + Math.max(0, b.spent - b.limit), 0);
  const adherence: ScoreComponent =
    totalLimit > 0
      ? {
          name: "Budget adherence",
          max: 30,
          points: 30 * (1 - clamp(overspend / totalLimit, 0, 1)),
          note:
            overspend > 0
              ? `₹${Math.round(overspend)} over budget across categories`
              : "every category within its limit",
        }
      : { name: "Budget adherence", max: 30, points: 15, note: "no budget set yet" };

  // Goal progress: 20 pts, proportional to goals on track. No goals: neutral half marks.
  const goals: ScoreComponent =
    input.goals.total > 0
      ? {
          name: "Goal progress",
          max: 20,
          points: 20 * (input.goals.onTrack / input.goals.total),
          note: `${input.goals.onTrack} of ${input.goals.total} goals on track`,
        }
      : { name: "Goal progress", max: 20, points: 10, note: "no goals set yet" };

  // Impulse control: 10 pts, full when late-night discretionary spend < 10% of total.
  const lateNight = input.expenses
    .filter((e) => isLateNight(e.spent_at) && (DISCRETIONARY as readonly string[]).includes(e.category as Category))
    .reduce((s, e) => s + e.amount, 0);
  const lateShare = total > 0 ? lateNight / total : 0;
  const impulse: ScoreComponent = {
    name: "Impulse control",
    max: 10,
    points: 10 * (1 - clamp((lateShare - 0.1) / 0.2, 0, 1)),
    note: `${Math.round(lateShare * 100)}% of spend is late-night discretionary (limit 10%)`,
  };

  const components = [savings, adherence, goals, impulse].map((c) => ({
    ...c,
    points: Math.round(c.points * 10) / 10,
  }));
  const score = Math.round(components.reduce((s, c) => s + c.points, 0));

  const worst = [...components].sort((a, b) => b.max - b.points - (a.max - a.points))[0];
  const reason =
    worst.max - worst.points < 0.5
      ? "Strong across the board this month."
      : `${worst.name} is holding the score back: ${worst.note}.`;

  return { score, components, reason };
}
