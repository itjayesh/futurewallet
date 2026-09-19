import { NextResponse } from "next/server";
import { z } from "zod";
import { resolvePersona, writeFutureNarrative } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { readJson, requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { computeFuture } from "@/lib/services/future";
import { factsWithLanguage } from "@/lib/services/language";

const params = z.object({
  monthlySaving: z.number().min(0).max(1_000_000),
  years: z.number().int().min(1).max(30).default(5),
  /** The screen asks for the narrative only when a control is released, not on every tick. */
  narrative: z.boolean().default(true),
  /** Assumed annual return in percent. */
  annualReturnPct: z.number().min(0).max(30).default(7),
  /** Put in on day one. */
  lumpSum: z.number().min(0).max(100_000_000).default(0),
  /** Yearly raise in the monthly saving, in percent. */
  stepUpPct: z.number().min(0).max(50).default(0),
  /** Show balances in today's rupees. */
  real: z.boolean().default(false),
});

/** Cache so a repeat request (and the demo, if the API is down) still gets a narrative. */
const narratives = new Map<string, string>();

async function compute(input: z.infer<typeof params>) {
  const { userId, repo } = await requireUser();
  const ctx = await loadContext(repo, userId, todayIST());
  const result = computeFuture(ctx, input.monthlySaving, input.years, {
    annualReturn: input.annualReturnPct / 100,
    lumpSum: input.lumpSum,
    stepUp: input.stepUpPct / 100,
    real: input.real,
  });

  let narrative: string | null = null;
  if (input.narrative) {
    const persona = resolvePersona(ctx.profile.persona, buildFactSheet(ctx));
    const lang = ctx.profile.language ?? "en";
    const key = [userId, persona, lang, input.monthlySaving, input.years, input.annualReturnPct, input.lumpSum, input.stepUpPct, input.real, ctx.avgSaving].join("|");
    narrative = narratives.get(key) ?? null;
    if (!narrative) {
      narrative = await writeFutureNarrative(persona, factsWithLanguage({ ...result.facts, ...result.narrativeExtras }, lang));
      narratives.set(key, narrative);
    }
  }

  return NextResponse.json({
    current: result.current,
    chosen: result.chosen,
    annualReturnPct: result.annualReturnPct,
    assumptions: result.assumptions,
    milestones: result.milestones,
    goalNeeds: result.goalNeeds,
    income: ctx.profile.monthly_income,
    goal: result.facts.goal ?? null,
    narrative,
  });
}

/** Initial load of the Future You screen: /api/future?monthlySaving=5000&years=5 (other levers optional). */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const num = (name: string, fallback: number) => (q.has(name) ? Number(q.get(name)) : fallback);
  return compute(
    params.parse({
      monthlySaving: num("monthlySaving", 5000),
      years: num("years", 5),
      narrative: q.get("narrative") !== "0",
      annualReturnPct: num("annualReturnPct", 7),
      lumpSum: num("lumpSum", 0),
      stepUpPct: num("stepUpPct", 0),
      real: q.get("real") === "1",
    }),
  );
});

export const POST = route(async (req: Request) => compute(params.parse(await readJson(req))));
