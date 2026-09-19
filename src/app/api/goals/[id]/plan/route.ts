import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { requireUser, route } from "@/lib/http";
import { goalPlans, loadContext } from "@/lib/services/context";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { userId, repo } = await requireUser();
  const { id } = await ctx.params;
  const found = goalPlans(await loadContext(repo, userId, todayIST())).find((p) => p.goal.id === id);
  if (!found) throw new HttpError(404, "Goal not found.");
  const { plan } = found;
  return NextResponse.json({
    monthlyNeeded: plan.monthlyNeeded,
    monthsLeft: plan.monthsLeft,
    onTrack: plan.onTrack,
    gap: plan.gap,
    suggestion: plan.suggestion,
  });
});
