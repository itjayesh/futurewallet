import { describe, expect, it } from "vitest";
import { monthsToReach, whatIf } from "./whatIf";

describe("monthsToReach", () => {
  it("is 0 when nothing is left to save", () => {
    expect(monthsToReach(0, 1000)).toBe(0);
  });
  it("rounds up whole months", () => {
    expect(monthsToReach(10_000, 3_000)).toBe(4);
  });
  it("is null when saving nothing", () => {
    expect(monthsToReach(10_000, 0)).toBeNull();
  });
  it("pauses saving while the extra cost exceeds it, then resumes", () => {
    // 10,000 needed, saving 3,000 a month, 4,000 EMI for 2 months: months 1-2 add 0, then 3,000/month.
    expect(monthsToReach(9_000, 3_000, 4_000, 2)).toBe(5);
  });
  it("only removes the cost part while it is smaller than the saving", () => {
    // 3,000 saving - 1,000 cost = 2,000 for 3 months = 6,000, then 3,000 a month.
    expect(monthsToReach(9_000, 3_000, 1_000, 3)).toBe(4);
  });
});

describe("whatIf", () => {
  const goals = [{ id: "g1", title: "Laptop", target: 60_000, saved: 12_000 }];

  it("computes the budget impact", () => {
    const r = whatIf({ monthlyCost: 2_500, months: 12, averageSaving: 3_800, goals });
    expect(r.budgetImpact).toEqual({
      monthlyCost: 2_500,
      months: 12,
      totalCost: 30_000,
      averageSavingBefore: 3_800,
      averageSavingAfter: 1_300,
      shortfallPerMonth: 0,
    });
  });

  it("delays a goal and reports the difference", () => {
    const r = whatIf({ monthlyCost: 2_500, months: 12, averageSaving: 3_800, goals });
    const g = r.goalDelays[0];
    expect(g.monthsCurrent).toBe(13); // 48,000 / 3,800
    expect(g.monthsAfter).toBeGreaterThan(g.monthsCurrent!);
    expect(g.delayMonths).toBe(g.monthsAfter! - g.monthsCurrent!);
  });

  it("reports a shortfall when the cost is more than the user saves", () => {
    const r = whatIf({ monthlyCost: 5_000, months: 6, averageSaving: 3_800, goals });
    expect(r.budgetImpact.shortfallPerMonth).toBe(1_200);
    expect(r.budgetImpact.averageSavingAfter).toBe(0);
  });

  it("has a null delay when the goal is never reached", () => {
    const r = whatIf({ monthlyCost: 1_000, months: 3, averageSaving: 0, goals });
    expect(r.goalDelays[0].delayMonths).toBeNull();
  });
});
