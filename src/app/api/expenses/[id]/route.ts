import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import { requireUser, route } from "@/lib/http";

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { userId, repo } = await requireUser();
  const { id } = await ctx.params;
  if (!(await repo.deleteExpense(userId, id))) throw new HttpError(404, "Expense not found.");
  return NextResponse.json({ ok: true });
});
