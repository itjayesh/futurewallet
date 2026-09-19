import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMemoryRepo } from "@/lib/db/memory";
import { budgetUsage, loadContext, type Ctx } from "./context";
import { detectNudges } from "./nudges";
import { seedDemo } from "./seed";
import { createToolExecutors, applyPendingAction } from "./tools";

const TODAY = "2026-09-19"; // Saturday
const USER = "nudge-user";
const repo = createMemoryRepo();
let ctx: Ctx;

beforeAll(async () => {
  vi.stubEnv("AI_MOCK", "1"); // proposeBudget must not call OpenAI in tests
  await seedDemo(repo, USER, TODAY);
  ctx = await loadContext(repo, USER, TODAY);
});

describe("detectNudges", () => {
  it("builds nudges from real numbers and caps the list", () => {
    const nudges = detectNudges(ctx);
    expect(nudges.length).toBeGreaterThan(0);
    expect(nudges.length).toBeLessThanOrEqual(4);
    for (const n of nudges) expect(n.summary).toMatch(/\d/);
  });

  it("flags a category that is at or above 80% of its limit", () => {
    const hot = budgetUsage(ctx).filter((u) => u.usedPct >= 80);
    const budgetNudges = detectNudges(ctx).filter((n) => n.kind === "budget_80");
    expect(budgetNudges.length).toBe(Math.min(2, hot.length));
  });

  it("only sends a weekly recap on a Monday", () => {
    expect(detectNudges(ctx).some((n) => n.kind === "weekly_recap")).toBe(false);
    const monday = detectNudges({ ...ctx, today: "2026-09-21" });
    expect(monday.some((n) => n.kind === "weekly_recap")).toBe(true);
  });
});

describe("newer tool executors", () => {
  const tools = createToolExecutors(repo, TODAY);

  it("lists recent expenses newest first with ids", async () => {
    const r = (await tools.list_recent_expenses(USER, { limit: 5 })) as { expenses: { id: string; date: string }[] };
    expect(r.expenses.length).toBeLessThanOrEqual(5);
    const dates = r.expenses.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(r.expenses[0].id).toBeTruthy();
  });

  it("computes a what-if with goal delays from code", async () => {
    const r = (await tools.run_what_if(USER, { description: "phone EMI", monthlyCost: 2500, months: 12 })) as {
      budgetImpact: { totalCost: number };
      goalDelays: unknown[];
    };
    expect(r.budgetImpact.totalCost).toBe(30000);
    expect(Array.isArray(r.goalDelays)).toBe(true);
  });

  it("suggests at most 3 savings, biggest first, each with a computed amount", async () => {
    const r = (await tools.suggest_savings(USER)) as { suggestions: { potentialSaving: number }[] };
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    const amounts = r.suggestions.map((s) => s.potentialSaving);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it("switches persona", async () => {
    await tools.set_persona(USER, "roast");
    expect((await repo.getProfile(USER))?.persona).toBe("roast");
    await tools.set_persona(USER, "friendly");
  });

  it("deletes an expense only after a confirmed pending action", async () => {
    const before = await repo.listExpenses(USER);
    const victim = before[0];
    const { actionId } = await tools.propose_action(USER, "delete_expense", { expenseId: victim.id });
    expect((await repo.listExpenses(USER)).length).toBe(before.length); // proposing changes nothing

    const pending = await repo.takePendingAction(USER, actionId);
    expect(pending).not.toBeNull();
    await applyPendingAction(repo, USER, TODAY, pending!);
    expect((await repo.listExpenses(USER)).length).toBe(before.length - 1);
  });

  it("refuses to propose deleting an expense that is not the user's", async () => {
    await expect(tools.propose_action(USER, "delete_expense", { expenseId: "nope" })).rejects.toThrow(/does not exist/);
  });

  it("proposes a generated budget, and applies it only on confirm", async () => {
    const { actionId, summary } = await tools.propose_action(USER, "generate_budget", {});
    expect(summary).toMatch(/savings/i);
    const pending = await repo.takePendingAction(USER, actionId);
    await applyPendingAction(repo, USER, TODAY, pending!);
    const budgets = await repo.listBudgets(USER, "2026-09-01");
    const total = budgets.reduce((s, b) => s + b.limit_amount, 0);
    expect(total).toBe(ctx.profile.monthly_income); // limits plus the savings remainder equal income
  });
});

afterAll(() => vi.unstubAllEnvs());
