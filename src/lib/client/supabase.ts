"use client";

import { createBrowserClient } from "@supabase/ssr";

/** True when the build has Supabase keys. Without them the app runs on the in-memory dev store and needs no login. */
export const authEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function supabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
