import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "@/lib/db/memory";
import { loadContext } from "./context";
import { analyse, detectPersonality, detectTriggers } from "./patterns";
import { seedDemo } from "./seed";

const TODAY = "2026-09-19";

async function seeded(user: string) {
  const repo = createMemoryRepo();
  await seedDemo(repo, user, TODAY);
  return { repo, ctx: await loadContext(repo, user, TODAY) };
}

describe("analyse", () => {
  it("finds the deliberate late-night pattern in the demo data", async () => {
    const { ctx } = await seeded("pat-1");
    const p = analyse(ctx);
    expect(p.lateNight.share).toBeGreaterThan(0.2);
    expect(p.lateNight.count).toBeGreaterThan(5);
    expect(p.delivery.perMonth).toBeGreaterThan(8);
    expect(p.topMerchant).not.toBeNull();
  });
});

describe("detectTriggers", () => {
  it("reports the late-night trigger with real numbers and a nudge", async () => {
    const { ctx } = await seeded("pat-2");
    const t = detectTriggers(ctx).find((x) => x.id === "late_night");
    expect(t).toBeDefined();
    expect(t!.headline).toMatch(/\d+% of your discretionary spend happens after 11 pm/);
    expect(t!.detail).toMatch(/₹/);
    expect(t!.nudge.length).toBeGreaterThan(10);
  });

  it("only returns triggers that clear their threshold", async () => {
    const { repo, ctx } = await seeded("pat-3");
    // Remove every late-night purchase: that trigger must disappear.
    for (const e of await repo.listExpenses("pat-3")) if (e.spent_at && Number(e.spent_at.slice(0, 2)) >= 23) await repo.deleteExpense("pat-3", e.id);
    const after = await loadContext(repo, "pat-3", TODAY);
    expect(detectTriggers(after).some((x) => x.id === "late_night")).toBe(false);
    expect(detectTriggers(ctx).some((x) => x.id === "late_night")).toBe(true);
  });
});

describe("detectPersonality", () => {
  it("names the Impulse Sniper for the demo user, with a 3-step plan built from their numbers", async () => {
    const { ctx } = await seeded("pat-4");
    const p = detectPersonality(ctx);
    expect(p.id).toBe("impulse_sniper");
    expect(p.plan).toHaveLength(3);
    expect(p.plan.join(" ")).toMatch(/₹/);
    expect(p.strength).toBeGreaterThan(0.5);
    expect(p.stats).toHaveLength(3);
  });

  it("falls back to Balanced Spender when no habit stands out", async () => {
    const { repo } = await seeded("pat-5");
    await repo.clearUserData("pat-5");
    await repo.addExpenses("pat-5", [{ amount: 500, category: "Groceries", merchant: "BigBasket", note: "", spent_on: "2026-09-10", spent_at: null, source: "manual" }]);
    // Clear fixed costs so the Fixed-Cost Fortress rule cannot fire either.
    await repo.upsertProfile("pat-5", { fixed_costs: [] });
    const p = detectPersonality(await loadContext(repo, "pat-5", TODAY));
    expect(p.id).toBe("balanced");
    expect(p.strength).toBe(0);
  });
});
