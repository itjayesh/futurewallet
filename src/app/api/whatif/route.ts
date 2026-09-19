import { NextResponse } from "next/server";
import { z } from "zod";
import { explainWhatIf, resolvePersona } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { whatIf } from "@/lib/finance";
import { readJson, requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { factsWithLanguage } from "@/lib/services/language";

const body = z.object({
  description: z.string().trim().min(1).max(120),
  monthlyCost: z.number().positive().max(1_000_000),
  months: z.number().int().min(1).max(120),
});

export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = body.parse(await readJson(req));
  const ctx = await loadContext(repo, userId, todayIST());

  const result = whatIf({
    monthlyCost: input.monthlyCost,
    months: input.months,
    averageSaving: ctx.avgSaving,
    goals: ctx.goals.map((g) => ({ id: g.id, title: g.title, target: g.target_amount, saved: g.saved_amount })),
  });
  const persona = resolvePersona(ctx.profile.persona, buildFactSheet(ctx));
  const narrative = await explainWhatIf(persona, factsWithLanguage({ description: input.description, ...result }, ctx.profile.language ?? "en"));
  return NextResponse.json({ ...result, narrative });
});
