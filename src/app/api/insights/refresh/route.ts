import { NextResponse } from "next/server";
import { writeInsight } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { factsWithLanguage } from "@/lib/services/language";

export const POST = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  const body = await writeInsight(ctx.profile.persona, factsWithLanguage(buildFactSheet(ctx), ctx.profile.language ?? "en"));
  const insight = await repo.saveInsight(userId, "dashboard", body);
  return NextResponse.json({ insight: { body: insight.body, created_at: insight.created_at } });
});
