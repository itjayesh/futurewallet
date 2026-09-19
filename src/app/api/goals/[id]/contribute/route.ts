import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { readJson, requireUser, route } from "@/lib/http";

const body = z.object({ amount: z.number().positive("Amount must be more than zero.").max(100_000_000) });

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { userId, repo } = await requireUser();
  const { id } = await ctx.params;
  const { amount } = body.parse(await readJson(req));
  const goal = await repo.contribute(userId, id, amount);
  if (!goal) throw new HttpError(404, "Goal not found.");
  return NextResponse.json({ goal });
});
