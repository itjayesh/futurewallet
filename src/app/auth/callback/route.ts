import { NextResponse } from "next/server";
import { serverClient, supabaseConfigured } from "@/lib/db/supabase";

/** Landing point for the email-confirmation link: swaps the one-time code for a session, then opens the app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (supabaseConfigured() && code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?confirm=failed", url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
