import { z } from "zod";
import { checkExpenseDate, proposeBudget, TOOL_SCHEMAS, type ProposableTool, type ToolExecutors } from "@/lib/ai";
import { firstOfMonth, isDate, lastOfMonth, monthOf } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import type { PendingAction, Repo } from "@/lib/db/types";
import { DISCRETIONARY, InfeasibleBudgetError, normalizeBudget, SAVINGS_CATEGORY, whatIf } from "@/lib/finance";
import { writeBudget } from "./budget";
import { budgetUsage, buildSummary, goalPlans, loadContext, spentByCategory } from "./context";
import { computeFuture } from "./future";

/** Lines stored on a pending generate_budget action. Written by the server, never by the model. */
const budgetLinesSchema = z.array(z.object({ category: z.string(), limit: z.number().min(0), reason: z.string() }));

/** How much of a discretionary category the "where can I save" suggestion assumes can be trimmed. */
const TRIM_PCT = 15;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Tool executors for the advisor agent. Reads return numbers computed by code.
 * The only write that runs immediately is add_expense; budget and goal changes are
 * stored as pending actions and applied by `applyPendingAction` after the user confirms.
 */
export function createToolExecutors(repo: Repo, today: string): ToolExecutors {
  const ctxFor = (userId: string, month?: string) => loadContext(repo, userId, today, month ?? monthOf(today));

  return {
    async get_spending_summary(userId, a) {
      const s = buildSummary(await ctxFor(userId, a.month));
      if (!a.category) {
        return { month: s.month, income: s.income, total: s.total, byCategory: s.byCategory, topMerchants: s.topMerchants };
      }
      const c = s.byCategory.find((x) => x.category === a.category);
      const b = s.budgetUsage.find((x) => x.category === a.category);
      return { month: s.month, category: a.category, spent: c?.amount ?? 0, share: c?.share ?? 0, limit: b?.limit ?? null, usedPct: b?.usedPct ?? null };
    },

    async get_budget_status(userId, a) {
      const ctx = await ctxFor(userId, a.month);
      const usage = budgetUsage(ctx);
      return {
        month: ctx.month,
        totalLimit: usage.reduce((s, u) => s + u.limit, 0),
        categories: usage.map(({ category, spent, limit, usedPct }) => ({ category, spent, limit, usedPct })),
        over: usage.filter((u) => u.usedPct >= 100).map((u) => u.category),
        nearLimit: usage.filter((u) => u.usedPct >= 80 && u.usedPct < 100).map((u) => u.category),
      };
    },

    async get_goals(userId) {
      const ctx = await ctxFor(userId);
      return goalPlans(ctx).map(({ goal, plan }) => ({
        id: goal.id,
        title: goal.title,
        target: goal.target_amount,
        saved: goal.saved_amount,
        deadline: goal.deadline,
        monthsLeft: plan.monthsLeft,
        monthlyNeeded: plan.monthlyNeeded,
        onTrack: plan.onTrack,
        gapPerMonth: plan.gap,
        suggestedCut: plan.suggestion,
        averageMonthlySaving: ctx.avgSaving,
      }));
    },

    async run_projection(userId, a) {
      return computeFuture(await ctxFor(userId), a.monthlySaving, a.years).facts;
    },

    async list_recent_expenses(userId, a) {
      const month = a.month ?? monthOf(today);
      const rows = await repo.listExpenses(userId, { from: firstOfMonth(month), to: lastOfMonth(month) });
      const wanted = a.category ? rows.filter((e) => e.category === a.category) : rows;
      const newest = [...wanted].sort((x, y) => y.spent_on.localeCompare(x.spent_on) || y.created_at.localeCompare(x.created_at));
      return {
        month,
        expenses: newest.slice(0, a.limit ?? 10).map((e) => ({
          id: e.id,
          date: e.spent_on,
          amount: e.amount,
          category: e.category,
          merchant: e.merchant,
        })),
      };
    },

    async run_what_if(userId, a) {
      const ctx = await ctxFor(userId);
      const result = whatIf({
        monthlyCost: a.monthlyCost,
        months: a.months,
        averageSaving: ctx.avgSaving,
        goals: ctx.goals.map((g) => ({ id: g.id, title: g.title, target: g.target_amount, saved: g.saved_amount })),
      });
      return { description: a.description, ...result };
    },

    async suggest_savings(userId) {
      const ctx = await ctxFor(userId);
      const spent = spentByCategory(ctx.current);
      const suggestions = DISCRETIONARY.map((category) => {
        const s = Math.round(spent.get(category) ?? 0);
        return {
          category,
          spent: s,
          average: ctx.categoryAverages[category] ?? null,
          trimPct: TRIM_PCT,
          potentialSaving: Math.round((s * TRIM_PCT) / 100 / 50) * 50,
        };
      })
        .filter((r) => r.spent > 0 && r.potentialSaving > 0)
        .sort((x, y) => y.potentialSaving - x.potentialSaving)
        .slice(0, 3);
      return {
        suggestions,
        totalPotentialSaving: suggestions.reduce((sum, r) => sum + r.potentialSaving, 0),
        averageMonthlySaving: ctx.avgSaving,
      };
    },

    async set_persona(userId, persona) {
      await repo.upsertProfile(userId, { persona });
      return { persona };
    },

    async add_expense(userId, a) {
      const problem = checkExpenseDate(a.spent_on, today);
      if (problem) throw new HttpError(400, `Cannot save that expense: ${problem}.`);
      const [created] = await repo.addExpenses(userId, [
        {
          amount: a.amount,
          category: a.category,
          merchant: a.merchant ?? "",
          note: a.note ?? "",
          spent_on: a.spent_on,
          spent_at: null,
          source: "nl",
        },
      ]);
      return { expenseId: created.id };
    },

    async propose_action(userId, tool, args) {
      const parsed = TOOL_SCHEMAS[tool].parse(args) as Record<string, unknown>;
      let summary: string;
      let stored: Record<string, unknown> | undefined;
      if (tool === "update_budget") {
        const budgets = await repo.listBudgets(userId, firstOfMonth(monthOf(today)));
        const line = budgets.find((b) => b.category === parsed.category);
        summary = `Set the ${parsed.category} limit to ${inr(Number(parsed.limit))}${line ? ` (now ${inr(line.limit_amount)})` : ""}.`;
      } else if (tool === "create_goal") {
        summary = `Create the goal "${parsed.title}": ${inr(Number(parsed.target))} by ${parsed.deadline}.`;
      } else if (tool === "delete_expense") {
        const expense = (await repo.listExpenses(userId)).find((e) => e.id === parsed.expenseId);
        if (!expense) throw new HttpError(404, "That expense does not exist.");
        summary = `Delete ${expense.merchant || expense.category} ${inr(expense.amount)} from ${expense.spent_on}.`;
      } else if (tool === "generate_budget") {
        const ctx = await ctxFor(userId);
        const income = ctx.profile.monthly_income;
        const fixedCosts = ctx.profile.fixed_costs.map((f) => ({ category: f.category, amount: f.amount }));
        const proposal = await proposeBudget({ income, fixedCosts, averages: ctx.categoryAverages });
        let lines;
        try {
          lines = normalizeBudget(income, fixedCosts, proposal);
        } catch (err) {
          if (err instanceof InfeasibleBudgetError) throw new HttpError(422, err.message);
          throw err;
        }
        const flexible = lines.filter((l) => l.category !== SAVINGS_CATEGORY);
        const top = [...flexible].sort((a, b) => b.limit - a.limit).slice(0, 4).map((l) => `${l.category} ${inr(l.limit)}`);
        const savings = lines.find((l) => l.category === SAVINGS_CATEGORY)?.limit ?? 0;
        summary = `Replace this month's budget: ${top.join(", ")}, and ${inr(savings)} to savings.`;
        stored = { lines: flexible };
      } else {
        const goal = (await repo.listGoals(userId)).find((g) => g.id === parsed.goalId);
        if (!goal) throw new HttpError(404, "That goal does not exist.");
        summary = `Add ${inr(Number(parsed.amount))} to "${goal.title}".`;
      }
      const pending = await repo.savePendingAction(userId, tool, stored ?? parsed, summary);
      return { actionId: pending.id, summary };
    },
  };
}

/** Runs a confirmed action. Validation is the same as the normal routes, whatever the model proposed. */
export async function applyPendingAction(
  repo: Repo,
  userId: string,
  today: string,
  action: PendingAction,
): Promise<{ message: string }> {
  const tool = action.tool as ProposableTool;

  if (tool === "generate_budget") {
    const lines = budgetLinesSchema.parse((action.args as { lines?: unknown }).lines);
    const ctx = await loadContext(repo, userId, today);
    await writeBudget(repo, userId, ctx.profile.monthly_income, ctx.month, lines);
    return { message: "Budget updated." };
  }

  const args = TOOL_SCHEMAS[tool].parse(action.args) as Record<string, unknown>;

  if (tool === "delete_expense") {
    if (!(await repo.deleteExpense(userId, String(args.expenseId)))) throw new HttpError(404, "That expense no longer exists.");
    return { message: "Expense removed." };
  }

  if (tool === "update_budget") {
    const ctx = await loadContext(repo, userId, today);
    const month = ctx.month;
    if (ctx.budgets.length === 0) throw new HttpError(409, "Generate a budget first, then change a limit.");
    const lines = ctx.budgets
      .filter((b) => b.category !== SAVINGS_CATEGORY)
      .map((b) => ({
        category: b.category,
        limit: b.category === args.category ? Number(args.limit) : b.limit_amount,
        reason: b.reason,
      }));
    if (!lines.some((l) => l.category === args.category)) lines.push({ category: String(args.category), limit: Number(args.limit), reason: "" });
    await writeBudget(repo, userId, ctx.profile.monthly_income, month, lines);
    return { message: `${args.category} limit set to ${inr(Number(args.limit))}.` };
  }

  if (tool === "create_goal") {
    if (!isDate(String(args.deadline)) || String(args.deadline) <= today) throw new HttpError(400, "A goal deadline must be a future date.");
    await repo.createGoal(userId, { title: String(args.title), target_amount: Number(args.target), deadline: String(args.deadline) });
    return { message: `Goal "${args.title}" created.` };
  }

  const goal = await repo.contribute(userId, String(args.goalId), Number(args.amount));
  if (!goal) throw new HttpError(404, "That goal does not exist.");
  return { message: `Added ${inr(Number(args.amount))} to "${goal.title}".` };
}
