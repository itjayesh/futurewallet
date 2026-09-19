import type { FactSheet } from "@/lib/ai";
import { addDays, addMonths, daysInMonth, firstOfMonth, lastMonths, lastOfMonth, monthLabel, monthOf } from "@/lib/dates";
import type { Budget, Expense, Goal, Profile, Repo } from "@/lib/db/types";
import {
  averageMonthlySaving,
  CATEGORIES,
  DISCRETIONARY,
  goalPlan,
  healthScore,
  SAVINGS_CATEGORY,
  type Category,
  type GoalPlan,
  type HealthScore,
} from "@/lib/finance";
import { notOnboarded } from "@/lib/errors";

const round = (n: number) => Math.round(n);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Ctx {
  userId: string;
  today: string;
  month: string;
  profile: Profile;
  /** Expenses for the six months ending at `month`. */
  expenses: Expense[];
  /** Expenses in `month` only. */
  current: Expense[];
  budgets: Budget[];
  goals: Goal[];
  months: string[];
  monthSpend: Record<string, number>;
  /** Completed months (up to 3) with data, used for averages. */
  historyMonths: string[];
  categoryAverages: Partial<Record<Category, number>>;
  avgSaving: number;
  /** Full-month spend used to judge the savings rate. */
  spendBasis: number;
}

export async function loadContext(repo: Repo, userId: string, today: string, month = monthOf(today)): Promise<Ctx> {
  const profile = await repo.getProfile(userId);
  if (!profile || profile.monthly_income <= 0) throw notOnboarded();

  const months = lastMonths(month, 6);
  const [expenses, budgets, goals] = await Promise.all([
    repo.listExpenses(userId, { from: firstOfMonth(months[0]), to: lastOfMonth(month) }),
    repo.listBudgets(userId, firstOfMonth(month)),
    repo.listGoals(userId),
  ]);

  const monthSpend: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  for (const e of expenses) {
    const m = monthOf(e.spent_on);
    if (m in monthSpend) monthSpend[m] += e.amount;
  }

  const historyMonths = months
    .slice(0, -1)
    .filter((m) => monthSpend[m] > 0)
    .slice(-3);
  const categoryAverages: Partial<Record<Category, number>> = {};
  if (historyMonths.length > 0) {
    for (const c of CATEGORIES) {
      const total = sum(
        expenses.filter((e) => e.category === c && historyMonths.includes(monthOf(e.spent_on))).map((e) => e.amount),
      );
      if (total > 0) categoryAverages[c] = round(total / historyMonths.length);
    }
  }

  const income = profile.monthly_income;
  const current = expenses.filter((e) => monthOf(e.spent_on) === month);
  const avgSaving = round(averageMonthlySaving(income, historyMonths.map((m) => monthSpend[m])));
  const spendBasis =
    historyMonths.length > 0 ? sum(historyMonths.map((m) => monthSpend[m])) / historyMonths.length : monthSpend[month];

  return {
    userId,
    today,
    month,
    profile,
    expenses,
    current,
    budgets,
    goals,
    months,
    monthSpend,
    historyMonths,
    categoryAverages,
    avgSaving,
    spendBasis,
  };
}

/* ---------- derived numbers ---------- */

export function spentByCategory(expenses: Expense[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of expenses) out.set(e.category, (out.get(e.category) ?? 0) + e.amount);
  return out;
}

export function budgetUsage(ctx: Ctx) {
  const spent = spentByCategory(ctx.current);
  return ctx.budgets
    .filter((b) => b.category !== SAVINGS_CATEGORY)
    .map((b) => {
      const s = spent.get(b.category) ?? 0;
      return {
        category: b.category,
        spent: round(s),
        limit: b.limit_amount,
        usedPct: b.limit_amount > 0 ? round((s / b.limit_amount) * 100) : s > 0 ? 100 : 0,
        reason: b.reason,
      };
    });
}

export function goalPlans(ctx: Ctx) {
  return ctx.goals.map((g) => ({
    goal: g,
    plan: goalPlan(g, ctx.today, ctx.avgSaving, ctx.categoryAverages),
  }));
}

export function health(ctx: Ctx): HealthScore {
  const plans = goalPlans(ctx);
  return healthScore({
    income: ctx.profile.monthly_income,
    expenses: ctx.current.map((e) => ({ amount: e.amount, category: e.category, spent_at: e.spent_at })),
    budgetUsage: budgetUsage(ctx),
    goals: { onTrack: plans.filter((p) => p.plan.onTrack).length, total: plans.length },
    monthlySpendEstimate: ctx.spendBasis,
  });
}

/** Rent and bills are fixed costs, not choices, so they are left out of "top merchants". */
const FIXED_CATEGORIES = new Set(["Rent & EMI", "Bills & Utilities"]);

function merchants(expenses: Expense[]) {
  const map = new Map<string, { spent: number; count: number }>();
  for (const e of expenses) {
    const key = e.merchant.trim();
    if (!key || FIXED_CATEGORIES.has(e.category)) continue;
    const cur = map.get(key) ?? { spent: 0, count: 0 };
    cur.spent += e.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, spent: round(v.spent), count: v.count }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
}

const isLateNight = (e: Expense) =>
  e.spent_at !== null && Number(e.spent_at.slice(0, 2)) >= 23 && (DISCRETIONARY as readonly string[]).includes(e.category);

/* ---------- API summary ---------- */

export function buildSummary(ctx: Ctx) {
  const total = round(ctx.monthSpend[ctx.month]);
  const spent = spentByCategory(ctx.current);
  const usage = budgetUsage(ctx);
  const h = health(ctx);
  const budgetTotal = sum(usage.map((u) => u.limit));
  const day = Number(ctx.today.slice(8, 10));
  const isCurrent = ctx.month === monthOf(ctx.today);

  return {
    month: ctx.month,
    monthLabel: monthLabel(ctx.month),
    total,
    income: ctx.profile.monthly_income,
    budgetTotal,
    saved: Math.max(0, ctx.profile.monthly_income - total),
    avgSaving: ctx.avgSaving,
    daysLeft: isCurrent ? daysInMonth(ctx.month) - day : 0,
    byCategory: [...spent.entries()]
      .map(([category, amount]) => ({
        category,
        amount: round(amount),
        share: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    trend: ctx.months.map((m) => ({ month: m, label: monthLabel(m, "short"), spent: round(ctx.monthSpend[m]) })),
    topMerchants: merchants(ctx.current).map((m) => ({ merchant: m.merchant, amount: m.spent, count: m.count })),
    budgetUsage: usage,
    healthScore: h.score,
    healthReason: h.reason,
    healthComponents: h.components,
    lateNight: {
      spend: round(sum(ctx.current.filter(isLateNight).map((e) => e.amount))),
      share: total > 0 ? Math.round((sum(ctx.current.filter(isLateNight).map((e) => e.amount)) / total) * 100) : 0,
    },
  };
}

/* ---------- AI fact sheet ---------- */

export function buildFactSheet(ctx: Ctx): FactSheet {
  const total = round(ctx.monthSpend[ctx.month]);
  const income = ctx.profile.monthly_income;
  const spent = spentByCategory(ctx.current);
  const prevMonth = addMonths(ctx.month, -1);
  const prevHasData = ctx.monthSpend[prevMonth] > 0;
  const prevSpent = spentByCategory(ctx.expenses.filter((e) => monthOf(e.spent_on) === prevMonth));
  const limits = new Map(ctx.budgets.map((b) => [b.category, b.limit_amount]));
  const usage = budgetUsage(ctx);
  const h = health(ctx);

  const categories = CATEGORIES.filter((c) => spent.has(c) || limits.has(c)).map((category) => {
    const s = round(spent.get(category) ?? 0);
    const limit = limits.get(category) ?? null;
    return {
      category,
      spent: s,
      limit,
      usedPct: limit && limit > 0 ? round((s / limit) * 100) : null,
      prevMonthSpent: prevHasData ? round(prevSpent.get(category) ?? 0) : null,
    };
  });

  const weekStart = addDays(ctx.today, -6);
  const lateWeek = ctx.expenses.filter((e) => e.spent_on >= weekStart && e.spent_on <= ctx.today && isLateNight(e));
  const lateMonth = sum(ctx.current.filter(isLateNight).map((e) => e.amount));

  return {
    asOf: ctx.today,
    month: ctx.month,
    currency: "INR",
    profile: { name: ctx.profile.name, monthlyIncome: income, persona: ctx.profile.persona, language: ctx.profile.language === "hinglish" || ctx.profile.language === "hi" ? "hinglish" : "en" },
    totals: {
      spent: total,
      saved: Math.max(0, income - total),
      savingsRatePct: income > 0 ? Math.max(0, round(((income - total) / income) * 100)) : 0,
    },
    byCategory: categories,
    trend: ctx.months.map((m) => ({ month: m, spent: round(ctx.monthSpend[m]) })),
    topMerchants: merchants(ctx.current),
    budget: {
      totalLimit: sum(usage.map((u) => u.limit)),
      overCategories: usage.filter((u) => u.usedPct >= 100).map((u) => u.category as Category),
      nearLimitCategories: usage.filter((u) => u.usedPct >= 80 && u.usedPct < 100).map((u) => u.category as Category),
    },
    goals: goalPlans(ctx).map(({ goal, plan }) => ({
      id: goal.id,
      title: goal.title,
      target: goal.target_amount,
      saved: goal.saved_amount,
      deadline: goal.deadline,
      monthlyNeeded: plan.monthlyNeeded,
      onTrack: plan.onTrack,
      gapPerMonth: plan.gap,
    })),
    patterns: {
      lateNightCount7d: lateWeek.length,
      lateNightSpend7d: round(sum(lateWeek.map((e) => e.amount))),
      lateNightSpendPct: total > 0 ? round((lateMonth / total) * 100) : 0,
    },
    health: { score: h.score, reason: h.reason },
  };
}

export type { GoalPlan };
