"use client";

import { ArrowDown, Flag, MessagesSquare, Moon, PenLine, Sun, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProjectionChart, type PathPoint } from "@/components/charts";
import { CountUp, InView, Reveal } from "@/components/motion";
import { cx } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";
import { toggleTheme, useDarkMode } from "@/lib/client/theme";
import { projectBalance } from "@/lib/finance/projection";
import { inr } from "@/lib/format";

const money = (n: number) => inr(n);

/** Public landing page. Everything interactive here runs in the browser on sample numbers, so it works without an account. */

type Cta = { label: string; href: string };

const VOICES = {
  friendly: {
    label: "Friendly",
    line: "Nice month, honestly. Food ran a bit high with 11 Zomato orders, so let us trim ₹800 there and you are back on track.",
  },
  roast: {
    label: "Roast",
    line: "11 Zomato orders? Bhai, you are paying the delivery guy's EMI. Cap it at 6 and keep ₹1,800.",
  },
  coach: {
    label: "Coach",
    line: "Food is 38% of spend against a 25% target. Reduce by ₹1,800 this month. Start with late-night orders.",
  },
} as const;
type VoiceKey = keyof typeof VOICES;

const FEATURES = [
  { Icon: PenLine, title: "Type it like you say it", body: "“kal Zomato pe 450 diye” becomes amount, category, merchant and date. Hindi, English or Hinglish." },
  { Icon: Wallet, title: "A budget you did not have to design", body: "Enter income and fixed costs. Every limit comes with a reason, and limits never add up to more than you earn." },
  { Icon: Flag, title: "Goals that say what to cut", body: "If a goal is off track, the advisor names one category and one amount that closes the gap." },
  { Icon: MessagesSquare, title: "An advisor that knows your numbers", body: "Ask anything. Answers use your own data, and it says so when data is missing." },
];

export default function Landing() {
  const [cta, setCta] = useState<Cta>({ label: "Get started", href: "/login" });

  // The button says where you will land: sign in, finish setup, or open the app.
  useEffect(() => {
    api<{ onboarded: boolean }>("/profile")
      .then((r) => setCta(r.onboarded ? { label: "Open dashboard", href: "/dashboard" } : { label: "Finish setup", href: "/onboarding" }))
      .catch((e) => setCta(e instanceof ApiError && e.status === 401 ? { label: "Get started", href: "/login" } : { label: "Get started", href: "/onboarding" }));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-primary font-headline text-base font-extrabold text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]">FW</div>
          <span className="font-headline text-lg font-bold tracking-tight">FutureWallet</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={cta.href} className="btn btn-primary hidden sm:inline-flex">
            {cta.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-20 px-4 pb-24 pt-10 sm:pt-16">
        <Reveal><section className="space-y-6">
          <span className="sticker bg-primary text-on-primary">AI budget and expense advisor</span>
          <h1 className="max-w-3xl font-headline text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Other apps show you numbers. FutureWallet shows you{" "}
            <span className="rounded-lg border-2 border-ink bg-future px-2 text-white">your future</span>.
          </h1>
          <p className="max-w-xl text-lg text-on-surface-variant">
            Log what you spend in plain Hinglish, get a budget you did not have to design, then drag one slider and meet the you of five years from now.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={cta.href} className="btn btn-primary">
              {cta.label}
            </Link>
            <a href="#try-it" className="btn btn-outline">
              Try it below
              <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </section></Reveal>

        <InView>
        <section id="try-it" className="scroll-mt-8 space-y-5">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight">Slide your future</h2>
            <p className="mt-1 text-on-surface-variant">Sample profile: saves ₹3,600 a month today. Drag to change what you put away.</p>
          </div>
          <FutureDemo />
        </section>
        </InView>

        <InView>
        <section className="space-y-5">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight">Same numbers, your kind of advisor</h2>
            <p className="mt-1 text-on-surface-variant">Pick a voice. Roast teases what you did with money, never who you are, and always ends with a fix.</p>
          </div>
          <VoiceDemo />
        </section>
        </InView>

        <InView>
        <section className="space-y-5">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight">Everything in one flow</h2>
          <ul className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title} className="rounded-xl border-[1.5px] border-outline-variant bg-surface-container-lowest p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-primary text-on-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-headline text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        </InView>

        <InView>
        <section className="pop-card rounded-xl bg-primary p-8 text-on-primary sm:p-10">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to see your own future?</h2>
          <p className="mt-2 max-w-lg">Set up takes about a minute. Or load the demo data and look around first.</p>
          <Link href={cta.href} className="btn btn-outline mt-6">
            {cta.label}
          </Link>
        </section>
        </InView>
      </main>

      <footer className="border-t-2 border-ink px-4 py-6 text-center text-xs text-secondary">
        General guidance, not regulated financial advice. Projections assume a 7% annual return, which is an assumption, not a promise.
      </footer>
    </div>
  );
}

function FutureDemo() {
  const CURRENT = 3_600;
  const YEARS = 5;
  const [saving, setSaving] = useState(5_000);

  const points: PathPoint[] = useMemo(() => {
    const cur = projectBalance(CURRENT, YEARS);
    const chosen = projectBalance(saving, YEARS);
    return cur.map((c, i) => ({ month: c.month, current: c.balance, chosen: chosen[i].balance }));
  }, [saving]);
  const end = points[points.length - 1];
  const diff = Math.round(end.chosen - end.current);

  return (
    <div className="pop-card space-y-5 rounded-xl bg-surface-container-lowest p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="font-headline text-5xl font-extrabold leading-none tracking-tight">
          <CountUp value={saving} format={money} duration={0.35} />
          <span className="ml-1 text-sm font-medium text-secondary">/month</span>
        </div>
        {diff > 0 ? <span className="sticker bg-future text-white">+{inr(diff)} in {YEARS} years</span> : <span className="sticker">Same as today</span>}
      </div>
      <input
        type="range"
        min={0}
        max={20_000}
        step={500}
        value={saving}
        onChange={(e) => setSaving(Number(e.target.value))}
        aria-label="Monthly savings"
        aria-valuetext={`${inr(saving)} a month`}
        className="w-full"
      />
      <ProjectionChart data={points} years={YEARS} />
      <p className="text-base leading-relaxed">
        Five years on, I have <strong>{inr(end.chosen)}</strong> instead of {inr(end.current)}.
        {diff > 0 ? ` That is ${inr(diff)} more, from the same salary.` : " Nothing changed, so nothing moved."}{" "}
        <span className="text-secondary">(Sample numbers. The real screen uses yours and lets the advisor write the message.)</span>
      </p>
    </div>
  );
}

function VoiceDemo() {
  const [voice, setVoice] = useState<VoiceKey>("roast");
  return (
    <div className="pop-card rounded-xl bg-surface-container-lowest p-5 sm:p-6">
      <div role="tablist" aria-label="Advisor style" className="flex gap-2">
        {(Object.keys(VOICES) as VoiceKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={voice === k}
            onClick={() => setVoice(k)}
            className={cx(
              "rounded-full border-2 px-4 py-1.5 font-headline text-sm font-bold transition-colors",
              voice === k ? "border-ink bg-primary text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]" : "border-ink/25 text-on-surface-variant hover:border-ink",
            )}
          >
            {VOICES[k].label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-secondary">The fact: 11 Zomato orders this month, ₹3,400 in total.</p>
      <div className="mt-4 rounded-xl rounded-bl-sm border-2 border-ink bg-surface-container-low px-4 py-3 text-lg leading-relaxed" aria-live="polite">
        {VOICES[voice].line}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const dark = useDarkMode();
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}

