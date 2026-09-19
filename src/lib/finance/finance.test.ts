import { describe, expect, it } from "vitest";
import {
  averageMonthlySaving,
  goalPlan,
  healthScore,
  monthsBetween,
  projectBalance,
  suggestCut,
} from "./index";

describe("projectBalance", () => {
  it("returns years*12+1 points starting at zero", () => {
    const s = projectBalance(5000, 5);
    expect(s).toHaveLength(61);
    expect(s[0]).toEqual({ month: 0, balance: 0 });
  });

  it("with 0% return is plain accumulation", () => {
    const s = projectBalance(1000, 1, 0);
    expect(s[12].balance).toBe(12000);
  });

  it("compounds monthly at 7% annual", () => {
    // Future value of an annuity: S * ((1+i)^n - 1) / i, i = 0.07/12, n = 60.
    const i = 0.07 / 12;
    const expected = 5000 * ((1 + i) ** 60 - 1) / i;
    expect(projectBalance(5000, 5)[60].balance).toBeCloseTo(expected, 1);
  });

  it("treats negative saving as zero", () => {
    expect(projectBalance(-500, 1)[12].balance).toBe(0);
  });
});

describe("averageMonthlySaving", () => {
  it("averages income minus spend", () => {
    expect(averageMonthlySaving(45000, [40000, 42000, 38000])).toBe(5000);
  });
  it("floors at zero", () => {
    expect(averageMonthlySaving(20000, [25000, 26000, 24000])).toBe(0);
  });
  it("returns 0 with no history", () => {
    expect(averageMonthlySaving(20000, [])).toBe(0);
  });
});

describe("monthsBetween", () => {
  it("rounds partial months up", () => {
    expect(monthsBetween("2026-09-19", "2027-03-19")).toBe(6);
    expect(monthsBetween("2026-09-19", "2026-10-01")).toBe(1);
  });
  it("is 0 for past or same-day deadlines", () => {
    expect(monthsBetween("2026-09-19", "2026-09-19")).toBe(0);
    expect(monthsBetween("2026-09-19", "2026-01-01")).toBe(0);
  });
});

describe("goalPlan", () => {
  const goal = {
    id: "g1",
    title: "Laptop",
    target_amount: 60000,
    saved_amount: 12000,
    deadline: "2027-03-19",
  };

  it("computes monthly need and on-track status", () => {
    const p = goalPlan(goal, "2026-09-19", 9000);
    expect(p.monthsLeft).toBe(6);
    expect(p.monthlyNeeded).toBe(8000);
    expect(p.onTrack).toBe(true);
    expect(p.gap).toBe(0);
    expect(p.suggestion).toBeNull();
  });

  it("reports the gap and a concrete cut when off track", () => {
    const p = goalPlan(goal, "2026-09-19", 5000, { "Food & Dining": 9000, Shopping: 3000 });
    expect(p.onTrack).toBe(false);
    expect(p.gap).toBe(3000);
    expect(p.suggestion).toEqual({ category: "Food & Dining", amount: 3000, closesGap: true });
  });

  it("flags a partial cut when no single category can close the gap", () => {
    const s = suggestCut(5000, { "Food & Dining": 4000, Shopping: 2000 });
    expect(s).toEqual({ category: "Food & Dining", amount: 1600, closesGap: false });
  });

  it("is on track once fully saved", () => {
    const p = goalPlan({ ...goal, saved_amount: 60000 }, "2026-09-19", 0);
    expect(p.onTrack).toBe(true);
    expect(p.monthlyNeeded).toBe(0);
  });

  it("needs the full remainder when the deadline has passed", () => {
    const p = goalPlan({ ...goal, deadline: "2026-01-01" }, "2026-09-19", 5000);
    expect(p.monthlyNeeded).toBe(48000);
    expect(p.onTrack).toBe(false);
  });
});

describe("healthScore", () => {
  const base = {
    income: 50000,
    expenses: [{ amount: 35000, category: "Rent & EMI", spent_at: null }],
    budgetUsage: [{ category: "Rent & EMI", spent: 35000, limit: 35000 }],
    goals: { onTrack: 2, total: 2 },
  };

  it("gives full marks for a healthy month", () => {
    const h = healthScore(base);
    expect(h.score).toBe(100);
    expect(h.reason).toMatch(/strong/i);
  });

  it("scales the savings-rate component linearly", () => {
    const h = healthScore({ ...base, expenses: [{ amount: 45000, category: "Rent & EMI", spent_at: null }] });
    // 10% saving rate -> half of 40 points.
    expect(h.components[0].points).toBe(20);
  });

  it("penalises overspend in proportion", () => {
    const h = healthScore({
      ...base,
      budgetUsage: [{ category: "Food & Dining", spent: 6000, limit: 5000 }],
    });
    // overspend 1000 / limit 5000 = 20% -> lose 6 of 30.
    expect(h.components[1].points).toBe(24);
  });

  it("penalises late-night discretionary spend above 10%", () => {
    const h = healthScore({
      ...base,
      expenses: [
        { amount: 30000, category: "Rent & EMI", spent_at: null },
        { amount: 10000, category: "Food & Dining", spent_at: "23:40" },
      ],
    });
    // 25% share -> (0.25-0.10)/0.20 = 0.75 lost -> 2.5 of 10 left.
    expect(h.components[3].points).toBe(2.5);
    expect(h.reason).toMatch(/impulse/i);
  });

  it("does not count late-night non-discretionary or unknown-time spend", () => {
    const h = healthScore({
      ...base,
      expenses: [
        { amount: 10000, category: "Health", spent_at: "23:40" },
        { amount: 10000, category: "Food & Dining", spent_at: null },
      ],
    });
    expect(h.components[3].points).toBe(10);
  });

  it("uses neutral marks when no budget or goals exist", () => {
    const h = healthScore({ ...base, budgetUsage: [], goals: { onTrack: 0, total: 0 } });
    expect(h.components[1].points).toBe(15);
    expect(h.components[2].points).toBe(10);
  });
});
