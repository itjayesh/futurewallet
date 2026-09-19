import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { requireUser, route } from "@/lib/http";

const scope = z.enum(["expenses", "budgets", "goals", "chat", "insights", "all"]);

/**
 * Deletes one kind of the user's data. `all` clears expenses, budgets, goals, insights and chat
 * but keeps the profile and the account. The user id is always the session's.
 */
export const DELETE = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const parsed = scope.safeParse(new URL(req.url).searchParams.get("scope"));
  if (!parsed.success) throw new HttpError(400, "scope must be one of expenses, budgets, goals, chat, insights, all.");
  await repo.deleteData(userId, parsed.data);
  return NextResponse.json({ ok: true, scope: parsed.data });
});
