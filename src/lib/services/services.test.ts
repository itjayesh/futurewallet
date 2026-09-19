import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryRepo } from "@/lib/db/memory";
import { firstOfMonth } from "@/lib/dates";
import { buildFactSheet, buildSummary, goalPlans, loadContext, type Ctx } from "./context";
import { computeFuture } from "./future";
import { seedDemo } from "./seed";

const TODAY = "2026-09-19";
const USER = "test-user";
const repo = createMemoryRepo();
let ctx: Ctx;

beforeAll(async () => {
  await seedDemo(repo, USER, TODAY);
  ctx = await loadContext(repo, USER, TODAY);
});

describe("loadContext", () => {
  it("refuses a user who has not onboarded", async () => {
    await expect(loadContext(repo, "nobody", TODAY)).rejects.toThrow(/onboarding/i);
  });

  it("uses completed months for the average saving, near the ₹3,800 story", () => {
    expect(ctx.historyMonths).toHaveLength(3);
    expect(ctx.historyMonths).not.toContain("2026-09");
    expect(ctx.avgSaving).toBeGreaterThan(2_500);
    expect(ctx.avgSaving).toBeLessThan(5_500);
  });
});

describe("seed data", () => {
  it("has six months of data and never a future-dated expense", () => {
    expect(ctx.months).toHaveLength(6);
    for (const m of ctx.months) expect(ctx.monthSpend[m]).toBeGreaterThan(0);
    expect(ctx.expenses.every((e) => e.spent_on <= TODAY)).toBe(true);
  });

  it("contains a deliberate late-night food pattern above the 10% line", () => {
    const s = buildSummary(ctx);
    expect(s.lateNight.share).toBeGreaterThan(10);
  });

  it("creates a budget for this month that fits within income", async () => {
    const budgets = await repo.listBudgets(USER, firstOfMonth("2026-09"));
    const total = budgets.reduce((a, b) => a + b.limit_amount, 0);
    expect(total).toBeLessThanOrEqual(45_000);
    expect(budgets.some((b) => b.category === "Savings")).toBe(true);
  });
});

describe("buildSummary", () => {
  it("returns the API shape with six trend points and sorted categories", () => {
    const s = buildSummary(ctx);
    expect(s.trend).toHaveLength(6);
    expect(s.total).toBe(s.byCategory.reduce((a, c) => a + c.amount, 0));
    const amounts = s.byCategory.map((c) => c.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(s.topMerchants.length).toBeLessThanOrEqual(5);
    expect(s.healthScore).toBeGreaterThanOrEqual(0);
    expect(s.healthScore).toBeLessThanOrEqual(100);
    expect(s.daysLeft).toBe(11);
  });
});

describe("goals", () => {
  it("has the Laptop off track and the Emergency fund on track", () => {
    const plans = goalPlans(ctx);
    const laptop = plans.find((p) => p.goal.title === "Laptop")!;
    const fund = plans.find((p) => p.goal.title === "Emergency fund")!;
    expect(laptop.plan.onTrack).toBe(false);
    expect(laptop.plan.suggestion).not.toBeNull();
    expect(fund.plan.onTrack).toBe(true);
  });
});

describe("buildFactSheet", () => {
  it("is consistent with the summary", () => {
    const f = buildFactSheet(ctx);
    const s = buildSummary(ctx);
    expect(f.totals.spent).toBe(s.total);
    expect(f.trend).toHaveLength(6);
    expect(f.goals).toHaveLength(2);
    expect(f.health.score).toBe(s.healthScore);
    expect(f.budget.totalLimit).toBe(s.budgetTotal);
    expect(f.patterns.lateNightSpendPct).toBeGreaterThan(10);
  });
});

describe("computeFuture", () => {
  it("projects both paths and reports the difference", () => {
    const r = computeFuture(ctx, 5_000, 5);
    expect(r.current.series).toHaveLength(61);
    expect(r.chosen.series).toHaveLength(61);
    expect(r.facts.chosen.endBalance).toBeGreaterThan(r.facts.current.endBalance);
    expect(r.facts.difference).toBe(r.facts.chosen.endBalance - r.facts.current.endBalance);
    expect(r.facts.annualReturnPct).toBe(7);
    expect(r.facts.goal?.title).toBe("Laptop");
  });
});
