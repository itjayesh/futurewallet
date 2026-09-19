import { describe, expect, it } from "vitest";
import { InfeasibleBudgetError, normalizeBudget, SAVINGS_CATEGORY } from "./budget";

const total = (lines: { limit: number }[]) => lines.reduce((s, l) => s + l.limit, 0);

describe("normalizeBudget", () => {
  const fixed = [{ category: "Rent & EMI", amount: 20000 }];

  it("never exceeds income and always adds a savings line", () => {
    const out = normalizeBudget(45000, fixed, [
      { category: "Food & Dining", limit: 12000, reason: "" },
      { category: "Transport", limit: 6000, reason: "" },
      { category: "Shopping", limit: 8000, reason: "" },
    ]);
    expect(total(out)).toBeLessThanOrEqual(45000);
    const savings = out.find((l) => l.category === SAVINGS_CATEGORY);
    expect(savings).toBeDefined();
    expect(savings!.limit).toBeGreaterThanOrEqual(4500);
  });

  it("keeps fixed costs as a floor and never scales them down", () => {
    const out = normalizeBudget(45000, fixed, [
      { category: "Rent & EMI", limit: 5000, reason: "model guess" },
      { category: "Food & Dining", limit: 30000, reason: "" },
    ]);
    expect(out.find((l) => l.category === "Rent & EMI")!.limit).toBe(20000);
  });

  it("drops unknown categories and rounds to ₹100", () => {
    const out = normalizeBudget(50000, [], [
      { category: "Crypto", limit: 5000, reason: "" },
      { category: "Groceries", limit: 4567, reason: "" },
    ]);
    expect(out.some((l) => l.category === "Crypto")).toBe(false);
    expect(out.find((l) => l.category === "Groceries")!.limit).toBe(4500);
  });

  it("leaves the model's limits alone when they already fit", () => {
    const out = normalizeBudget(50000, [], [{ category: "Food & Dining", limit: 6000, reason: "ok" }]);
    expect(out.find((l) => l.category === "Food & Dining")).toEqual({
      category: "Food & Dining",
      limit: 6000,
      reason: "ok",
    });
    expect(out.find((l) => l.category === SAVINGS_CATEGORY)!.limit).toBe(44000);
  });

  it("throws when fixed costs exceed income", () => {
    expect(() => normalizeBudget(15000, fixed, [])).toThrow(InfeasibleBudgetError);
  });
});
