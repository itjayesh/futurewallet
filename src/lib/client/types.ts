import type { buildSummary } from "@/lib/services/context";
import type { FutureResult } from "@/lib/services/future";
import type { GoalPlan } from "@/lib/finance";

export type Summary = ReturnType<typeof buildSummary> & {
  persona: "friendly" | "roast" | "coach";
  name: string;
  insight: { body: string; created_at: string } | null;
};

export type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  merchant: string;
  note: string;
  spent_on: string;
  spent_at: string | null;
  source: string;
};

export type BudgetView = {
  month: string;
  income: number;
  /** Categories that come from the user's fixed costs, so a full limit is expected, not a warning. */
  fixedCategories: string[];
  budgets: { category: string; limit: number; reason: string; spent: number; usedPct: number }[];
};

export type GoalRow = {
  id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  deadline: string;
  plan: GoalPlan;
};

export type FutureResponse = {
  current: FutureResult["current"];
  chosen: FutureResult["chosen"];
  annualReturnPct: number;
  assumptions: FutureResult["assumptions"];
  milestones: FutureResult["milestones"];
  goalNeeds: FutureResult["goalNeeds"];
  income: number;
  goal: { title: string; target: number; monthsCurrent: number | null; monthsChosen: number | null } | null;
  narrative: string | null;
};
