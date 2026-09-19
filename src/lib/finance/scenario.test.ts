import { describe, expect, it } from "vitest";
import { projectBalance } from "./projection";
import { buildMilestones, firstMonthAtOrAbove, inTodaysRupees, projectScenario } from "./scenario";

describe("projectScenario", () => {
  it("matches the plain projection when there is no lump sum or step-up", () => {
    const a = projectScenario({ monthlySaving: 5000, years: 5 });
    const b = projectBalance(5000, 5);
    expect(a).toHaveLength(61);
    expect(a[60].balance).toBeCloseTo(b[60].balance, 1);
  });

  it("starts from the lump sum and compounds it", () => {
    const s = projectScenario({ monthlySaving: 0, years: 1, lumpSum: 10_000, annualReturn: 0.12 });
    expect(s[0].balance).toBe(10_000);
    // 1% a month for 12 months.
    expect(s[12].balance).toBeCloseTo(10_000 * 1.01 ** 12, 0);
  });

  it("raises the monthly saving at the start of each new year", () => {
    const s = projectScenario({ monthlySaving: 1000, years: 2, annualReturn: 0, stepUp: 0.1 });
    expect(s[12].contributed).toBe(12_000); // year 1 at 1,000 a month
    expect(s[24].contributed).toBeCloseTo(12_000 + 12 * 1100, 5); // year 2 at 1,100 a month
  });

  it("tracks what the user put in separately from growth", () => {
    const s = projectScenario({ monthlySaving: 2000, years: 3, lumpSum: 5000 });
    const end = s[36];
    expect(end.contributed).toBe(5000 + 36 * 2000);
    expect(end.balance).toBeGreaterThan(end.contributed);
  });

  it("treats negative inputs as zero", () => {
    const s = projectScenario({ monthlySaving: -100, years: 1, lumpSum: -5 });
    expect(s[12].balance).toBe(0);
  });
});

describe("inTodaysRupees", () => {
  it("shrinks later balances by inflation and leaves month 0 alone", () => {
    const s = projectScenario({ monthlySaving: 1000, years: 5, annualReturn: 0 });
    const real = inTodaysRupees(s, 0.06);
    expect(real[0].balance).toBe(s[0].balance);
    expect(real[60].balance).toBeCloseTo(s[60].balance / 1.06 ** 5, 0);
    expect(real[60].contributed).toBe(s[60].contributed);
  });
});

describe("firstMonthAtOrAbove", () => {
  const s = projectScenario({ monthlySaving: 1000, years: 2, annualReturn: 0 });
  it("finds the month a target is reached", () => {
    expect(firstMonthAtOrAbove(s, 5000)).toBe(5);
  });
  it("is null when it is never reached", () => {
    expect(firstMonthAtOrAbove(s, 1_000_000)).toBeNull();
  });
  it("is 0 for a target of zero", () => {
    expect(firstMonthAtOrAbove(s, 0)).toBe(0);
  });
});

describe("buildMilestones", () => {
  const goals = [{ id: "g1", title: "Laptop", target_amount: 60_000, saved_amount: 12_000 }];

  it("uses what is still left on each goal and adds standard milestones, cheapest first", () => {
    const m = buildMilestones({ goals, monthlySpend: 40_000 });
    expect(m.find((x) => x.id === "goal:g1")?.target).toBe(48_000);
    expect(m.map((x) => x.target)).toEqual([...m.map((x) => x.target)].sort((a, b) => a - b));
    expect(m.find((x) => x.id === "emergency")?.target).toBe(240_000);
  });

  it("skips a standard milestone the user already has a goal for", () => {
    const m = buildMilestones({ goals: [...goals, { id: "g2", title: "Emergency fund", target_amount: 50_000, saved_amount: 20_000 }], monthlySpend: 40_000 });
    expect(m.some((x) => x.id === "emergency")).toBe(false);
    expect(m.find((x) => x.id === "goal:g2")?.target).toBe(30_000);
  });

  it("leaves out goals that are already fully saved", () => {
    const m = buildMilestones({ goals: [{ id: "g3", title: "Phone", target_amount: 10_000, saved_amount: 10_000 }], monthlySpend: 0 });
    expect(m.some((x) => x.id === "goal:g3")).toBe(false);
  });
});
