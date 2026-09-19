"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion";
import { Button, Card, Disclaimer, Field, inputCls, Notice } from "@/components/ui";
import { authEnabled, supabaseBrowser } from "@/lib/client/supabase";

type Mode = "signin" | "signup";

/** Turns Supabase's messages into something a user can act on. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password do not match. If you are new, choose “Create account”.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/already registered/i.test(message)) return "That email already has an account. Sign in instead.";
  if (/password should be at least/i.test(message)) return "Use a password with at least 6 characters.";
  if (/rate limit/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Without Supabase keys there is nothing to sign in to.
  useEffect(() => {
    if (!authEnabled) router.replace("/");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) return setError("Enter your email and a password.");
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        router.replace("/");
        router.refresh();
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (err) throw err;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setInfo("Account created. Check your email for a confirmation link, then come back and sign in.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-primary font-headline text-base font-extrabold text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]">FW</div>
        <span className="font-headline text-lg font-bold tracking-tight text-on-surface">FutureWallet</span>
      </div>
      <Reveal>
      <Card hero className="p-6 sm:p-8">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-secondary">Other apps show you numbers. FutureWallet shows you your future.</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="Email">
            <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 6 characters." : undefined}>
            <input
              className={inputCls}
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-secondary">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-semibold text-on-surface underline underline-offset-2"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </Card>
      </Reveal>
      <Disclaimer />
    </main>
  );
}
