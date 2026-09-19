import { NextResponse } from "next/server";
import { z } from "zod";
import { checkExpenseDate } from "@/lib/ai";
import { firstOfMonth, isMonth, lastOfMonth, monthOf, nowIST, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { CATEGORIES } from "@/lib/finance";
import { readJson, requireUser, route } from "@/lib/http";

const body = z.object({
  amount: z.number().positive("Amount must be more than zero.").max(10_000_000),
  category: z.enum(CATEGORIES),
  merchant: z.string().trim().max(80).default(""),
  spent_on: z.string(),
  note: z.string().trim().max(200).optional(),
  source: z.enum(["manual", "nl", "csv"]).default("manual"),
});

export const GET = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const month = new URL(req.url).searchParams.get("month") ?? monthOf(todayIST());
  if (!isMonth(month)) throw new HttpError(400, "month must be YYYY-MM.");
  const expenses = await repo.listExpenses(userId, { from: firstOfMonth(month), to: lastOfMonth(month) });
  return NextResponse.json({ expenses });
});

export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const input = body.parse(await readJson(req));
  const today = todayIST();
  const problem = checkExpenseDate(input.spent_on, today);
  if (problem) throw new HttpError(400, `Invalid date: ${problem}.`);

  const [expense] = await repo.addExpenses(userId, [
    {
      amount: input.amount,
      category: input.category,
      merchant: input.merchant,
      note: input.note ?? "",
      spent_on: input.spent_on,
      // An expense logged for today gets the current time, so late-night spending is detected.
      spent_at: input.spent_on === today ? nowIST() : null,
      source: input.source,
    },
  ]);
  return NextResponse.json({ expense }, { status: 201 });
});
