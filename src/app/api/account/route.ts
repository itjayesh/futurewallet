import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { readJson, requireUser, route } from "@/lib/http";

const body = z.object({ confirm: z.literal("DELETE") });

/**
 * Permanently deletes the signed-in user's account and everything in it.
 * The caller must send { "confirm": "DELETE" } so it can never happen by accident.
 */
export const DELETE = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, 'Send { "confirm": "DELETE" } to delete the account.');
  await repo.deleteAccount(userId);
  return NextResponse.json({ ok: true });
});
