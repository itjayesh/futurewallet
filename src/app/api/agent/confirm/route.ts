import { NextResponse } from "next/server";
import { z } from "zod";
import { todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/errors";
import { readJson, requireUser, route } from "@/lib/http";
import { applyPendingAction } from "@/lib/services/tools";

const body = z.object({ actionId: z.string().min(1).max(64), decision: z.enum(["confirm", "cancel"]) });

/**
 * Applies or discards an action the advisor proposed. An action can be taken once,
 * only by the user who owns it, and is validated again here.
 */
export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const { actionId, decision } = body.parse(await readJson(req));
  const pending = await repo.takePendingAction(userId, actionId);
  if (!pending) throw new HttpError(404, "That action has already been handled or has expired.");
  if (decision === "cancel") return NextResponse.json({ ok: true, message: "Cancelled. Nothing was changed." });
  const { message } = await applyPendingAction(repo, userId, todayIST(), pending);
  return NextResponse.json({ ok: true, message });
});
