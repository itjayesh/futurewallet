import { DAYS_PER_MONTH, DISCRETIONARY, type Category } from "./constants";

export type Goal = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  deadline: string; // YYYY-MM-DD
};

export type GoalSuggestion = {
  category: Category;
  amount: number;
  closesGap: boolean;
};

export type GoalPlan = {
  monthsLeft: number;
  monthlyNeeded: number;
  onTrack: boolean;
  gap: number;
  suggestion: GoalSuggestion | null;
};

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole months from today to the deadline, rounded up; 0 when the deadline has passed. */
export function monthsBetween(today: string, deadline: string): number {
  const days = (toUtc(deadline) - toUtc(today)) / 86_400_000;
  if (days <= 0) return 0;
  return Math.ceil(days / DAYS_PER_MONTH);
}

/**
 * Largest single cut (discretionary category, capped at 40% of its monthly
 * average, rounded up to the nearest ₹100) that closes the gap. If no single
 * category can close it, returns the biggest available cut with closesGap=false.
 */
export function suggestCut(
  gap: number,
  categoryAverages: Partial<Record<Category, number>>,
): GoalSuggestion | null {
  if (gap <= 0) return null;
  const needed = Math.ceil(gap / 100) * 100;
  let best: GoalSuggestion | null = null;
  for (const category of DISCRETIONARY) {
    const avg = categoryAverages[category] ?? 0;
    const maxCut = Math.floor((avg * 0.4) / 100) * 100;
    if (maxCut <= 0) continue;
    if (maxCut >= needed) {
      // Prefer the category where the required cut is the smallest share of spend.
      const candidate = { category, amount: needed, closesGap: true };
      if (!best || !best.closesGap || needed / avg < best.amount / (categoryAverages[best.category] ?? 1)) {
        best = candidate;
      }
    } else if (!best || (!best.closesGap && maxCut > best.amount)) {
      best = { category, amount: maxCut, closesGap: false };
    }
  }
  return best;
}

export function goalPlan(
  goal: Goal,
  today: string,
  averageSaving: number,
  categoryAverages: Partial<Record<Category, number>> = {},
): GoalPlan {
  const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
  const monthsLeft = monthsBetween(today, goal.deadline);
  const monthlyNeeded =
    remaining === 0 ? 0 : monthsLeft === 0 ? remaining : Math.ceil(remaining / monthsLeft);
  const onTrack = remaining === 0 || averageSaving >= monthlyNeeded;
  const gap = onTrack ? 0 : monthlyNeeded - averageSaving;
  return {
    monthsLeft,
    monthlyNeeded,
    onTrack,
    gap,
    suggestion: suggestCut(gap, categoryAverages),
  };
}
