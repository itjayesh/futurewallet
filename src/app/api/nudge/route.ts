import { NextResponse } from "next/server";
import { resolvePersona, writeNudge } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { languageRule } from "@/lib/services/language";
import { detectNudge } from "@/lib/services/nudge";

/** The one nudge worth showing now, phrased in the user's advisor style. `nudge` is null when nothing needs saying. */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  const trigger = detectNudge(ctx);
  if (!trigger) return NextResponse.json({ nudge: null });
  const persona = resolvePersona(ctx.profile.persona, buildFactSheet(ctx));
  const text = await writeNudge(persona, { ...trigger, facts: { ...trigger.facts, reply_language: languageRule(ctx.profile.language ?? "en") } });
  return NextResponse.json({ nudge: { kind: trigger.kind, text } });
});
