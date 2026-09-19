import type { NudgeTrigger } from "@/lib/ai";
import { addDays } from "@/lib/dates";
import { DISCRETIONARY } from "@/lib/finance";
import { budgetUsage, goalPlans, type Ctx } from "./context";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const MAX_NUDGES = 4;

/**
 * F11: the agent speaks first. Code detects what is worth saying and builds a plain
 * summary from real numbers; the AI only rephrases it in the user's persona, and the
 * summary is the fallback text if the model is unavailable.
 */
export function detectNudges(ctx: Ctx): NudgeTrigger[] {
  const out: NudgeTrigger[] = [];

  for (const u of budgetUsage(ctx).filter((b) => b.usedPct >= 80).sort((a, b) => b.usedPct - a.usedPct).slice(0, 2)) {
    out.push({
      kind: "budget_80",
      summary:
        u.usedPct >= 100
          ? `${u.category} is over its limit: ${inr(u.spent)} spent of ${inr(u.limit)}.`
          : `${u.category} is at ${u.usedPct}% of its limit: ${inr(u.spent)} of ${inr(u.limit)}.`,
      facts: { category: u.category, usedPct: u.usedPct, spent: u.spent, limit: u.limit },
    });
  }

  const weekStart = addDays(ctx.today, -6);
  const week = ctx.expenses.filter((e) => e.spent_on >= weekStart && e.spent_on <= ctx.today);
  const lateNight = week.filter(
    (e) => e.spent_at !== null && Number(e.spent_at.slice(0, 2)) >= 23 && (DISCRETIONARY as readonly string[]).includes(e.category),
  );
  if (lateNight.length >= 3) {
    const total = Math.round(sum(lateNight.map((e) => e.amount)));
    out.push({
      kind: "late_night",
      summary: `${lateNight.length} late-night orders in the last 7 days, ${inr(total)} in total.`,
      facts: { orders: lateNight.length, total },
    });
  }

  const behind = goalPlans(ctx)
    .filter(({ goal, plan }) => !plan.onTrack && goal.saved_amount < goal.target_amount)
    .sort((a, b) => b.plan.gap - a.plan.gap)[0];
  if (behind) {
    out.push({
      kind: "goal_off_track",
      summary: `${behind.goal.title} is off track: you need ${inr(behind.plan.monthlyNeeded)} a month and are about ${inr(behind.plan.gap)} short.`,
      facts: { goal: behind.goal.title, monthlyNeeded: behind.plan.monthlyNeeded, gapPerMonth: behind.plan.gap },
    });
  }

  const isMonday = new Date(`${ctx.today}T00:00:00Z`).getUTCDay() === 1;
  if (isMonday && week.length > 0) {
    const spent = Math.round(sum(week.map((e) => e.amount)));
    // The recap is the overview, so on Mondays it leads and cannot be cut by the cap.
    out.unshift({
      kind: "weekly_recap",
      summary: `Last 7 days: ${inr(spent)} spent across ${week.length} expenses.`,
      facts: { spent, expenses: week.length },
    });
  }

  return out.slice(0, MAX_NUDGES);
}
