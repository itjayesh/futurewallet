import { NextResponse } from "next/server";
import { z } from "zod";
import { isDate, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { readJson, requireUser, route } from "@/lib/http";
import { goalPlans, loadContext } from "@/lib/services/context";

const body = z.object({
  title: z.string().trim().min(1, "Give the goal a name.").max(80),
  target: z.number().positive("Target must be more than zero.").max(100_000_000),
  deadline: z.string().refine(isDate, "deadline must be YYYY-MM-DD"),
});

export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  return NextResponse.json({
    averageSaving: ctx.avgSaving,
    goals: goalPlans(ctx).map(({ goal, plan }) => ({ ...goal, plan })),
  });
});

export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = body.parse(await readJson(req));
  if (input.deadline <= todayIST()) throw new HttpError(400, "The deadline must be a future date.");
  const goal = await repo.createGoal(userId, { title: input.title, target_amount: input.target, deadline: input.deadline });
  return NextResponse.json({ goal }, { status: 201 });
});
