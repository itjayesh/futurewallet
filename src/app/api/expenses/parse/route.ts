import { NextResponse } from "next/server";
import { z } from "zod";
import { parseExpense } from "@/lib/ai";
import { isDate, todayIST } from "@/lib/dates";
import { readJson, requireUser, route } from "@/lib/http";

const body = z.object({
  text: z.string().trim().min(1, "Type the expense first.").max(300),
  today: z.string().refine(isDate, "today must be YYYY-MM-DD").optional(),
});

export const POST = route(async (req: Request) => {
  await requireUser();
  const { text, today } = body.parse(await readJson(req));
  const parsed = await parseExpense(text, today ?? todayIST());
  return NextResponse.json({
    amount: parsed.amount,
    category: parsed.category,
    merchant: parsed.merchant,
    spent_on: parsed.spent_on,
    confidence: parsed.confidence,
    ...(parsed.needs_clarification ? { needs_clarification: parsed.needs_clarification } : {}),
  });
});
