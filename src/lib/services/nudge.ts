import type { NudgeTrigger } from "@/lib/ai";
import { inr } from "@/lib/format";
import { budgetUsage, buildSummary, goalPlans, type Ctx } from "./context";

/**
 * Picks the one thing worth telling the user right now. Detection is pure code
 * over computed numbers; the AI only phrases the trigger it is handed.
 * Priority: a budget at 80% or more, then late-night spending, then an off-track goal.
 */
export function detectNudge(ctx: Ctx): NudgeTrigger | null {
  // A fixed cost sitting at its full limit is expected, not a warning.
  const fixed = new Set(ctx.profile.fixed_costs.map((f) => f.category));
  const hot = budgetUsage(ctx)
    .filter((u) => !fixed.has(u.category) && u.usedPct >= 80)
    .sort((a, b) => b.usedPct - a.usedPct)[0];
  if (hot) {
    return {
      kind: "budget_80",
      summary:
        hot.usedPct >= 100
          ? `${hot.category} is over its ${inr(hot.limit)} limit: ${inr(hot.spent)} spent.`
          : `${hot.category} is at ${hot.usedPct}% of its ${inr(hot.limit)} limit (${inr(hot.spent)} spent).`,
      facts: { category: hot.category, spent: hot.spent, limit: hot.limit, usedPct: hot.usedPct },
    };
  }

  const late = buildSummary(ctx).lateNight;
  if (late.share > 10) {
    return {
      kind: "late_night",
      summary: `${inr(late.spend)} of this month's spending (${late.share}%) went on discretionary purchases after 11 pm.`,
      facts: { spend: late.spend, sharePct: late.share },
    };
  }

  const off = goalPlans(ctx).find((p) => !p.plan.onTrack);
  if (off) {
    return {
      kind: "goal_off_track",
      summary: `${off.goal.title} needs ${inr(off.plan.monthlyNeeded)} a month but you save about ${inr(ctx.avgSaving)}: a gap of ${inr(off.plan.gap)}.`,
      facts: {
        title: off.goal.title,
        monthlyNeeded: off.plan.monthlyNeeded,
        averageSaving: ctx.avgSaving,
        gap: off.plan.gap,
        ...(off.plan.suggestion ? { suggestedCategory: off.plan.suggestion.category, suggestedCut: off.plan.suggestion.amount } : {}),
      },
    };
  }
  return null;
}
