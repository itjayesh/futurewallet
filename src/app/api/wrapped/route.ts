import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { loadContext } from "@/lib/services/context";
import { buildWrapped } from "@/lib/services/wrapped";

/** Data for the Wrapped story: this month, computed from the user's real records. */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  return NextResponse.json({ wrapped: buildWrapped(ctx) });
});
