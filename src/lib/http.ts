import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiError } from "@/lib/ai/client";
import { createMemoryRepo } from "@/lib/db/memory";
import { createSupabaseRepo, serverClient, supabaseConfigured } from "@/lib/db/supabase";
import type { Repo } from "@/lib/db/types";

import { HttpError } from "@/lib/errors";

export { HttpError, notOnboarded } from "@/lib/errors";

const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";

export type Session = { userId: string; repo: Repo };

/**
 * Resolves the signed-in user. With Supabase configured the user comes from the
 * auth cookie and every query runs under row-level security. Without it (local
 * development) a single fixed user and an in-memory store are used.
 */
export async function requireUser(): Promise<Session> {
  if (!supabaseConfigured()) return { userId: DEV_USER_ID, repo: createMemoryRepo() };
  const db = await serverClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in required.");
  return { userId: data.user.id, repo: createSupabaseRepo(db) };
}

/** Wraps a route handler so every failure becomes `{ error }` JSON with a suitable status. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return NextResponse.json({ error: `${where}${first?.message ?? "Invalid request."}` }, { status: 400 });
      }
      if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: 502 });
      console.error("[api] unhandled error", err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}
