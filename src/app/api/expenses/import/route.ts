import { NextResponse } from "next/server";
import { z } from "zod";
import { categorizeBatch } from "@/lib/ai";
import { parseStatementCsv } from "@/lib/csv";
import { checkExpenseDate } from "@/lib/ai";
import { isDate, todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { CATEGORIES } from "@/lib/finance";
import { readJson, requireUser, route } from "@/lib/http";

const MAX_BYTES = 1_000_000;
const BATCH = 50;
/** Rows below this confidence are flagged for the user to review before import. */
const REVIEW_BELOW = 0.7;

const commit = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().refine(isDate),
        description: z.string().trim().min(1).max(120),
        amount: z.number().positive().max(10_000_000),
        category: z.enum(CATEGORIES),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Two steps on one route. A multipart upload returns categorized rows for review.
 * A JSON body with the reviewed rows saves them.
 */
export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const { rows } = commit.parse(await readJson(req));
    const today = todayIST();
    const bad = rows.find((r) => checkExpenseDate(r.date, today));
    if (bad) throw new HttpError(400, `Row "${bad.description}" has an invalid date (${checkExpenseDate(bad.date, today)}).`);
    const saved = await repo.addExpenses(
      userId,
      rows.map((r) => ({
        amount: r.amount,
        category: r.category,
        merchant: r.description,
        note: "",
        spent_on: r.date,
        spent_at: null,
        source: "csv" as const,
      })),
    );
    return NextResponse.json({ imported: saved.length });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a CSV file in the 'file' field.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That file is too large. Keep it under 1 MB.");

  const parsed = parseStatementCsv(await file.text());
  if (parsed.error) throw new HttpError(400, parsed.error);
  if (parsed.rows.length === 0) throw new HttpError(400, "No readable rows were found in that file.");

  const categorized: { index: number; category: string; confidence: number }[] = [];
  for (let i = 0; i < parsed.rows.length; i += BATCH) {
    const chunk = parsed.rows.slice(i, i + BATCH);
    const out = await categorizeBatch(chunk.map((r) => ({ description: r.description, amount: r.amount })));
    for (const o of out) categorized.push({ ...o, index: o.index + i });
  }
  const byIndex = new Map(categorized.map((c) => [c.index, c]));

  return NextResponse.json({
    skipped: parsed.skipped,
    rows: parsed.rows.map((r, index) => {
      const c = byIndex.get(index);
      return {
        ...r,
        category: c?.category ?? "Other",
        confidence: c?.confidence ?? 0,
        needsReview: !c || c.confidence < REVIEW_BELOW,
      };
    }),
  });
});
