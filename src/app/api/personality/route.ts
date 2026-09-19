import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { loadContext } from "@/lib/services/context";
import { detectPersonality } from "@/lib/services/patterns";

/** The user's money personality, chosen by code from their real spending. */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  return NextResponse.json({ name: ctx.profile.name, personality: detectPersonality(ctx) });
});
