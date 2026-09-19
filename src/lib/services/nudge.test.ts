import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "@/lib/db/memory";
import { loadContext } from "./context";
import { detectNudge } from "./nudge";
import { seedDemo } from "./seed";

const TODAY = "2026-09-19";

describe("detectNudge", () => {
  it("flags the fullest non-fixed budget first, never a fixed cost at its limit", async () => {
    const repo = createMemoryRepo();
    await seedDemo(repo, "nudge-user", TODAY);
    const t = detectNudge(await loadContext(repo, "nudge-user", TODAY));
    expect(t?.kind).toBe("budget_80");
    // Rent & EMI sits at exactly 100% of its limit but is a fixed cost, so it must not win.
    expect(t?.facts.category).not.toBe("Rent & EMI");
    expect(Number(t?.facts.usedPct)).toBeGreaterThanOrEqual(80);
  });

  it("falls back to an off-track goal when no budget is hot and late-night spend is low", async () => {
    const repo = createMemoryRepo();
    await seedDemo(repo, "nudge-user-2", TODAY);
    // Loosen every limit so nothing is at 80%, and remove the late-night purchases.
    const month = "2026-09-01";
    const budgets = await repo.listBudgets("nudge-user-2", month);
    await repo.replaceBudgets(
      "nudge-user-2",
      month,
      budgets.map((b) => ({ category: b.category, limit_amount: b.limit_amount * 10, reason: b.reason })),
    );
    const expenses = await repo.listExpenses("nudge-user-2");
    for (const e of expenses) if (e.spent_at && Number(e.spent_at.slice(0, 2)) >= 23) await repo.deleteExpense("nudge-user-2", e.id);

    const t = detectNudge(await loadContext(repo, "nudge-user-2", TODAY));
    expect(t?.kind).toBe("goal_off_track");
    expect(t?.facts.title).toBe("Laptop");
    expect(t?.summary).toMatch(/Laptop needs/);
  });
});
