import { NextResponse } from "next/server";
import { resolvePersona, writeNudge } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { detectNudges } from "@/lib/services/nudges";

/**
 * Proactive nudges. Code decides what is worth saying; the AI only phrases each one
 * in the user's persona (the code-built summary is the fallback).
 */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  const persona = resolvePersona(ctx.profile.persona, buildFactSheet(ctx));

  const nudges = await Promise.all(
    detectNudges(ctx).map(async (trigger, i) => ({
      id: `${trigger.kind}-${i}`,
      kind: trigger.kind,
      text: await writeNudge(persona, trigger),
      facts: Object.entries(trigger.facts).map(([label, value]) => ({ label, value: String(value) })),
    })),
  );
  return NextResponse.json({ nudges });
});
