import type { ProjectionFacts } from "@/lib/ai";
import {
  ANNUAL_RETURN,
  INFLATION,
  buildMilestones,
  firstMonthAtOrAbove,
  inTodaysRupees,
  monthsToReach,
  projectScenario,
  type Milestone,
  type ScenarioPoint,
} from "@/lib/finance";
import { goalPlans, type Ctx } from "./context";

export interface FutureOptions {
  /** Assumed annual return as a fraction. Defaults to the app's 7%. */
  annualReturn?: number;
  lumpSum?: number;
  /** Yearly raise in the monthly saving, as a fraction. */
  stepUp?: number;
  /** Show balances in today's rupees. */
  real?: boolean;
}

export interface MilestoneResult extends Milestone {
  monthsCurrent: number | null;
  monthsChosen: number | null;
}

export interface FutureResult {
  current: { monthlySaving: number; series: ScenarioPoint[] };
  chosen: { monthlySaving: number; series: ScenarioPoint[] };
  annualReturnPct: number;
  assumptions: { annualReturnPct: number; inflationPct: number; stepUpPct: number; lumpSum: number; real: boolean };
  milestones: MilestoneResult[];
  /** The monthly saving the nearest open goal needs, rounded up to ₹500. */
  goalNeeds: { title: string; monthly: number } | null;
  facts: ProjectionFacts;
  /** Extra computed figures for the AI to quote in the message. Numbers here are the only ones it may add. */
  narrativeExtras: Record<string, unknown>;
}

/** Runs both projections. Pure code: the narrative is written later from `facts`. */
export function computeFuture(ctx: Ctx, monthlySaving: number, years: number, opts: FutureOptions = {}): FutureResult {
  const annualReturn = opts.annualReturn ?? ANNUAL_RETURN;
  const lumpSum = opts.lumpSum ?? 0;
  const stepUp = opts.stepUp ?? 0;
  const real = opts.real ?? false;
  const currentSaving = ctx.avgSaving;

  // The status quo has no lump sum and no yearly raise: it is what happens if nothing changes.
  const shape = (s: ScenarioPoint[]) => (real ? inTodaysRupees(s) : s);
  const current = shape(projectScenario({ monthlySaving: currentSaving, years, annualReturn }));
  const chosen = shape(projectScenario({ monthlySaving, years, annualReturn, lumpSum, stepUp }));
  const end = (s: ScenarioPoint[]) => Math.round(s[s.length - 1].balance);

  const milestones: MilestoneResult[] = buildMilestones({ goals: ctx.goals, monthlySpend: ctx.spendBasis }).map((m) => ({
    ...m,
    monthsCurrent: firstMonthAtOrAbove(current, m.target),
    monthsChosen: firstMonthAtOrAbove(chosen, m.target),
  }));

  const open = ctx.goals
    .filter((g) => g.saved_amount < g.target_amount)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

  const needed = goalPlans(ctx)
    .filter((p) => p.goal.saved_amount < p.goal.target_amount && p.plan.monthlyNeeded > 0)
    .sort((a, b) => a.goal.deadline.localeCompare(b.goal.deadline))[0];

  const facts: ProjectionFacts = {
    years,
    annualReturnPct: Math.round(annualReturn * 100),
    current: { monthlySaving: currentSaving, endBalance: end(current) },
    chosen: { monthlySaving, endBalance: end(chosen) },
    difference: end(chosen) - end(current),
    ...(open
      ? {
          goal: {
            title: open.title,
            target: open.target_amount,
            monthsCurrent: monthsToReach(open.target_amount - open.saved_amount, currentSaving),
            monthsChosen: monthsToReach(open.target_amount - open.saved_amount, monthlySaving),
          },
        }
      : {}),
  };

  const last = chosen[chosen.length - 1];
  return {
    current: { monthlySaving: currentSaving, series: current },
    chosen: { monthlySaving, series: chosen },
    annualReturnPct: facts.annualReturnPct,
    assumptions: {
      annualReturnPct: facts.annualReturnPct,
      inflationPct: Math.round(INFLATION * 100),
      stepUpPct: Math.round(stepUp * 100),
      lumpSum,
      real,
    },
    milestones,
    goalNeeds: needed ? { title: needed.goal.title, monthly: Math.ceil(needed.plan.monthlyNeeded / 500) * 500 } : null,
    facts,
    narrativeExtras: {
      lumpSum,
      yearlyRaisePct: Math.round(stepUp * 100),
      valuesAreInTodaysRupees: real,
      youPutIn: Math.round(last.contributed),
      growth: Math.round(last.balance - last.contributed),
      milestones: milestones.slice(0, 3).map((m) => ({ title: m.title, target: m.target, monthsOnChosenPath: m.monthsChosen, monthsOnCurrentPath: m.monthsCurrent })),
    },
  };
}
