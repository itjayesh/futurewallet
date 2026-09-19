const MAX_MONTHS = 600;

/**
 * Months until `remaining` is saved, when the user saves `monthlySaving` a month
 * but `extraCost` a month is taken out for the first `costMonths` months.
 * Monthly contribution never goes below zero. Returns null if it is never reached.
 */
export function monthsToReach(
  remaining: number,
  monthlySaving: number,
  extraCost = 0,
  costMonths = 0,
): number | null {
  if (remaining <= 0) return 0;
  let saved = 0;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    const cost = m <= costMonths ? extraCost : 0;
    saved += Math.max(0, monthlySaving - cost);
    if (saved >= remaining) return m;
  }
  return null;
}

export type WhatIfInput = {
  monthlyCost: number;
  months: number;
  averageSaving: number;
  goals: { id: string; title: string; target: number; saved: number }[];
};

export type WhatIfResult = {
  budgetImpact: {
    monthlyCost: number;
    months: number;
    totalCost: number;
    averageSavingBefore: number;
    averageSavingAfter: number;
    /** How much the cost exceeds what the user saves today; 0 when it fits. */
    shortfallPerMonth: number;
  };
  goalDelays: {
    goalId: string;
    title: string;
    monthsCurrent: number | null;
    monthsAfter: number | null;
    /** Extra months caused by the purchase; null when either date cannot be reached. */
    delayMonths: number | null;
  }[];
};

export function whatIf(input: WhatIfInput): WhatIfResult {
  const { monthlyCost, months, averageSaving } = input;
  return {
    budgetImpact: {
      monthlyCost,
      months,
      totalCost: monthlyCost * months,
      averageSavingBefore: averageSaving,
      averageSavingAfter: Math.max(0, averageSaving - monthlyCost),
      shortfallPerMonth: Math.max(0, monthlyCost - averageSaving),
    },
    goalDelays: input.goals.map((g) => {
      const remaining = Math.max(0, g.target - g.saved);
      const monthsCurrent = monthsToReach(remaining, averageSaving);
      const monthsAfter = monthsToReach(remaining, averageSaving, monthlyCost, months);
      return {
        goalId: g.id,
        title: g.title,
        monthsCurrent,
        monthsAfter,
        delayMonths: monthsCurrent !== null && monthsAfter !== null ? monthsAfter - monthsCurrent : null,
      };
    }),
  };
}
