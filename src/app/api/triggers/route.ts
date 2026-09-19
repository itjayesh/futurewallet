import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { loadContext } from "@/lib/services/context";
import { detectTriggers } from "@/lib/services/patterns";

/** Why the spending happens: patterns in timing, found by code over the last 90 days. */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  return NextResponse.json({ triggers: detectTriggers(ctx) });
});
