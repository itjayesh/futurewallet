import { NextResponse } from "next/server";
import { isMonth, monthOf, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { requireUser, route } from "@/lib/http";
import { buildSummary, loadContext } from "@/lib/services/context";

export const GET = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const today = todayIST();
  const month = new URL(req.url).searchParams.get("month") ?? monthOf(today);
  if (!isMonth(month)) throw new HttpError(400, "month must be YYYY-MM.");
  const ctx = await loadContext(repo, userId, today, month);
  const insight = await repo.latestInsight(userId, "dashboard");
  return NextResponse.json({
    ...buildSummary(ctx),
    persona: ctx.profile.persona,
    name: ctx.profile.name,
    insight: insight ? { body: insight.body, created_at: insight.created_at } : null,
  });
});
