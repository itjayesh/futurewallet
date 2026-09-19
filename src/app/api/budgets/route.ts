import { NextResponse } from "next/server";
import { z } from "zod";
import { isMonth, monthOf, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { readJson, requireUser, route } from "@/lib/http";
import { budgetUsage, loadContext } from "@/lib/services/context";
import { writeBudget } from "@/lib/services/budget";

const putBody = z.object({
  month: z.string().refine(isMonth).optional(),
  budgets: z
    .array(z.object({ category: z.string(), limit: z.number().min(0).max(10_000_000), reason: z.string().max(200).optional() }))
    .min(1)
    .max(20),
});

async function view(userId: string, repo: Parameters<typeof loadContext>[0], month: string) {
  const ctx = await loadContext(repo, userId, todayIST(), month);
  const usage = new Map(budgetUsage(ctx).map((u) => [u.category, u]));
  return {
    month,
    income: ctx.profile.monthly_income,
    fixedCategories: [...new Set(ctx.profile.fixed_costs.map((f) => f.category))],
    budgets: ctx.budgets.map((b) => ({
      category: b.category,
      limit: b.limit_amount,
      reason: b.reason,
      spent: usage.get(b.category)?.spent ?? 0,
      usedPct: usage.get(b.category)?.usedPct ?? 0,
    })),
  };
}

export const GET = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const month = new URL(req.url).searchParams.get("month") ?? monthOf(todayIST());
  if (!isMonth(month)) throw new HttpError(400, "month must be YYYY-MM.");
  return NextResponse.json(await view(userId, repo, month));
});

export const PUT = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = putBody.parse(await readJson(req));
  const month = input.month ?? monthOf(todayIST());
  const ctx = await loadContext(repo, userId, todayIST(), month);
  await writeBudget(repo, userId, ctx.profile.monthly_income, month, input.budgets);
  return NextResponse.json(await view(userId, repo, month));
});
