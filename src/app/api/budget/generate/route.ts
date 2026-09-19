import { NextResponse } from "next/server";
import { z } from "zod";
import { proposeBudget } from "@/lib/ai";
import { firstOfMonth, monthOf, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { CATEGORIES, InfeasibleBudgetError, normalizeBudget } from "@/lib/finance";
import { readJson, requireUser, route } from "@/lib/http";
import { loadContext } from "@/lib/services/context";

const body = z
  .object({
    income: z.number().positive().max(10_000_000).optional(),
    fixedCosts: z
      .array(z.object({ category: z.enum(CATEGORIES), amount: z.number().min(0).max(10_000_000) }))
      .max(20)
      .optional(),
  })
  .default({});

/**
 * The model proposes limits with reasons; code then enforces the rules (fixed costs
 * as a floor, savings line, total within income) before anything is saved.
 */
export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = body.parse(await readJson(req).catch(() => ({})));
  const today = todayIST();
  const ctx = await loadContext(repo, userId, today);

  const income = input.income ?? ctx.profile.monthly_income;
  const fixedCosts = input.fixedCosts ?? ctx.profile.fixed_costs.map((f) => ({ category: f.category, amount: f.amount }));

  const proposal = await proposeBudget({ income, fixedCosts, averages: ctx.categoryAverages });
  let lines;
  try {
    lines = normalizeBudget(income, fixedCosts, proposal);
  } catch (err) {
    if (err instanceof InfeasibleBudgetError) throw new HttpError(422, err.message);
    throw err;
  }

  const saved = await repo.replaceBudgets(
    userId,
    firstOfMonth(monthOf(today)),
    lines.map((l) => ({ category: l.category, limit_amount: l.limit, reason: l.reason })),
  );
  return NextResponse.json({
    budgets: saved.map((b) => ({ category: b.category, limit: b.limit_amount, reason: b.reason })),
  });
});
