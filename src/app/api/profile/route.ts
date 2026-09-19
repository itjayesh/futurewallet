import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, readJson, requireUser, route } from "@/lib/http";
import { CATEGORIES } from "@/lib/finance";

const body = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  income: z.number().positive().max(10_000_000).optional(),
  fixedCosts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        category: z.enum(CATEGORIES).optional(),
        amount: z.number().min(0).max(10_000_000),
      }),
    )
    .max(20)
    .optional(),
  persona: z.enum(["friendly", "roast", "coach"]).optional(),
  language: z.enum(["en", "hinglish", "hi"]).optional(),
});

/** Rent, EMI and loans are "Rent & EMI"; anything else fixed is a bill. */
const fixedCategory = (name: string) => (/rent|emi|loan|mortgage/i.test(name) ? "Rent & EMI" : "Bills & Utilities");

export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const profile = await repo.getProfile(userId);
  return NextResponse.json({ profile, onboarded: Boolean(profile && profile.monthly_income > 0) });
});

export const PUT = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = body.parse(await readJson(req));
  const existing = await repo.getProfile(userId);

  const income = input.income ?? existing?.monthly_income ?? 0;
  const fixed_costs =
    input.fixedCosts?.map((f) => ({ name: f.name, category: f.category ?? fixedCategory(f.name), amount: f.amount })) ??
    existing?.fixed_costs ??
    [];
  if (income <= 0) throw new HttpError(400, "Monthly income is required.");
  if (fixed_costs.reduce((s, f) => s + f.amount, 0) > income) {
    throw new HttpError(400, "Fixed costs cannot be more than your income.");
  }

  const profile = await repo.upsertProfile(userId, {
    name: input.name ?? existing?.name ?? "",
    monthly_income: income,
    fixed_costs,
    ...(input.persona ? { persona: input.persona } : {}),
    ...(input.language ? { language: input.language } : {}),
  });
  return NextResponse.json({ profile });
});
