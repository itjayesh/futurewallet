import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { seedDemo } from "@/lib/services/seed";

/** Replaces the signed-in user's data with the demo dataset and profile. */
export const POST = route(async () => {
  const { userId, repo } = await requireUser();
  const result = await seedDemo(repo, userId, todayIST());
  return NextResponse.json({ ok: true, ...result });
});
