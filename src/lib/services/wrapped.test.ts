import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "@/lib/db/memory";
import { loadContext } from "./context";
import { seedDemo } from "./seed";
import { buildWrapped } from "./wrapped";

const TODAY = "2026-09-19";

async function wrapped(user: string) {
  const repo = createMemoryRepo();
  await seedDemo(repo, user, TODAY);
  return buildWrapped(await loadContext(repo, user, TODAY));
}

describe("buildWrapped", () => {
  it("summarises this month from real records", async () => {
    const w = await wrapped("wr-1");
    expect(w.name).toBe("Meera");
    expect(w.monthLabel).toBe("September 2026");
    expect(w.daysCovered).toBe(19);
    expect(w.total).toBeGreaterThan(20000);
    expect(w.txCount).toBeGreaterThan(20);
    expect(w.perDay).toBe(Math.round(w.total / 19));
    expect(w.topCategories).toHaveLength(3);
    expect(w.topCategories[0].amount).toBeGreaterThanOrEqual(w.topCategories[1].amount);
  });

  it("compares with the same days of last month, not the whole month", async () => {
    const w = await wrapped("wr-2");
    expect(w.vsLastMonthPct).not.toBeNull();
    // A full month is ~40k; 19 days of it is about half. The percentage must not look like a 50% drop.
    expect(Math.abs(w.vsLastMonthPct!)).toBeLessThan(45);
  });

  it("finds the late-night habit, the busiest weekday and the personality", async () => {
    const w = await wrapped("wr-3");
    expect(w.lateNight).not.toBeNull();
    expect(w.lateNight!.sharePct).toBeGreaterThan(10);
    expect(w.weekday).toHaveLength(7);
    expect(w.weekday[0].label).toBe("Mon");
    expect(w.busiestDay).not.toBeNull();
    expect(w.personality.id).toBe("impulse_sniper");
  });

  it("excludes rent and bills from merchants, weekdays and the biggest purchase", async () => {
    const w = await wrapped("wr-4");
    expect(w.topMerchant?.merchant).not.toBe("Rent");
    expect(w.biggest?.amount).toBeLessThan(10000);
  });

  it("counts no-spend days and the longest streak over the days covered", async () => {
    const w = await wrapped("wr-5");
    expect(w.noSpend.calendar).toHaveLength(19);
    expect(w.noSpend.days).toBe(w.noSpend.calendar.filter((c) => !c.spent).length);
    expect(w.noSpend.longestStreak).toBeLessThanOrEqual(w.noSpend.days);
  });

  it("projects the ₹5,000 a month move for the Future slide", async () => {
    const w = await wrapped("wr-6");
    expect(w.future.monthlySaving).toBe(5000);
    expect(w.future.difference).toBe(w.future.chosen - w.future.current);
    expect(w.future.chosen).toBeGreaterThan(w.future.current);
  });
});
