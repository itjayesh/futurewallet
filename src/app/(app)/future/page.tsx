"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { ChartFrame, ProjectionChart, ProjectionTable, type PathPoint } from "@/components/charts";
import { CountUp, Reveal, Typewriter } from "@/components/motion";
import RichText from "@/components/RichText";
import { Button, Card, cx, Disclaimer, ErrorState, Eyebrow, inputCls, Notice, Segmented, Skeleton } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/client/api";
import { cleanAiText } from "@/lib/client/aiText";
import type { FutureResponse } from "@/lib/client/types";
import { firstMonthAtOrAbove, INFLATION, inTodaysRupees, projectScenario } from "@/lib/finance/scenario";
import { inr, parseNumber, plural } from "@/lib/format";

const money = (n: number) => inr(n);

const MAX = 20_000;
const STEP = 500;
const DEFAULT_SAVING = 5_000;
const YEAR_CHOICES = ["1", "3", "5", "10"] as const;
const RETURN_CHOICES = [
  { id: "4", label: "Careful 4%" },
  { id: "7", label: "Balanced 7%" },
  { id: "10", label: "Bold 10%" },
] as const;
const LUMP_CHIPS = [0, 10_000, 50_000];

type Params = { monthlySaving: number; years: number; annualReturnPct: number; lumpSum: number; stepUpPct: number; real: boolean };

const roundStep = (n: number) => Math.max(0, Math.min(MAX, Math.round(n / STEP) * STEP));

/** "2 yr 3 mo", "7 months", or why it does not happen. */
function when(months: number | null, years: number): string {
  if (months === null) return `Not within ${plural(years, "year")}`;
  if (months === 0) return "Already there";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return plural(m, "month");
  return m === 0 ? plural(y, "year") : `${y} yr ${m} mo`;
}

export default function FuturePage() {
  const { data, error, reload } = useApi<FutureResponse>(`/future?monthlySaving=${DEFAULT_SAVING}&years=5`);
  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  return <Future first={data} />;
}

function Future({ first }: { first: FutureResponse }) {
  const { t } = useApp();
  const currentSaving = first.current.monthlySaving;

  // The scenario the user is tuning.
  const [saving, setSaving] = useState(DEFAULT_SAVING);
  const [years, setYears] = useState(5);
  const [returnPct, setReturnPct] = useState(7);
  const [lumpText, setLumpText] = useState("");
  const [stepUp, setStepUp] = useState(0);
  const [real, setReal] = useState(false);
  const lump = Math.max(0, parseNumber(lumpText) || 0);

  const [narrative, setNarrative] = useState<string | null>(first.narrative);
  const [thinking, setThinking] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const seq = useRef(0);

  const params: Params = { monthlySaving: saving, years, annualReturnPct: returnPct, lumpSum: lump, stepUpPct: stepUp, real };
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  // Both projections run in the browser, so every control moves the chart with no server round trip.
  const { current, chosen } = useMemo(() => {
    const cur = projectScenario({ monthlySaving: currentSaving, years, annualReturn: returnPct / 100 });
    const ch = projectScenario({ monthlySaving: saving, years, annualReturn: returnPct / 100, lumpSum: lump, stepUp: stepUp / 100 });
    return real ? { current: inTodaysRupees(cur), chosen: inTodaysRupees(ch) } : { current: cur, chosen: ch };
  }, [currentSaving, saving, years, returnPct, lump, stepUp, real]);

  const points: PathPoint[] = useMemo(() => current.map((c, i) => ({ month: c.month, current: c.balance, chosen: chosen[i].balance })), [current, chosen]);
  const end = points[points.length - 1];
  // From the rounded figures on screen, so the sticker always equals chosen minus current.
  const difference = Math.round(end.chosen) - Math.round(end.current);
  const last = chosen[chosen.length - 1];
  const putIn = Math.round(last.contributed);
  const growth = Math.max(0, Math.round(last.balance - last.contributed));

  const milestones = useMemo(
    () =>
      first.milestones.map((m) => ({
        ...m,
        monthsCurrent: firstMonthAtOrAbove(current, m.target),
        monthsChosen: firstMonthAtOrAbove(chosen, m.target),
      })),
    [first.milestones, current, chosen],
  );
  const marks = milestones.slice(0, 3).map((m) => ({ label: m.title.split(" (")[0], value: m.target }));

  // The message is written by the server when a control is released or chosen, never on every tick.
  const commit = useCallback(async (patch: Partial<Params> = {}) => {
    const mine = ++seq.current;
    setThinking(true);
    setNarrativeError(null);
    try {
      const r = await api<FutureResponse>("/future", { json: { ...latest.current, ...patch, narrative: true } });
      if (mine === seq.current) setNarrative(r.narrative);
    } catch (e) {
      if (mine === seq.current) setNarrativeError(errorMessage(e));
    } finally {
      if (mine === seq.current) setThinking(false);
    }
  }, []);

  const chooseSaving = (value: number) => {
    const v = roundStep(value);
    setSaving(v);
    void commit({ monthlySaving: v });
  };

  return (
    <>
      <Reveal index={0}>
        <Card hero className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>{t("monthly_savings")}</Eyebrow>
              <p className="mt-1 text-sm text-secondary">Drag to see where your money goes in {plural(years, "year")}.</p>
            </div>
            <div className="text-right">
              <span className="font-headline text-5xl font-extrabold leading-none tracking-tight text-on-surface">
                <CountUp value={saving} format={money} duration={0.35} />
              </span>
              <span className="ml-1 text-sm text-secondary">/month</span>
            </div>
          </div>
          <div>
            <input
              type="range"
              min={0}
              max={MAX}
              step={STEP}
              value={saving}
              onChange={(e) => setSaving(Number(e.target.value))}
              onPointerUp={(e) => void commit({ monthlySaving: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => void commit({ monthlySaving: Number((e.target as HTMLInputElement).value) })}
              aria-label="Monthly savings"
              aria-valuetext={`${inr(saving)} a month`}
              className="w-full"
            />
            <div className="tabular mt-1 flex justify-between text-xs text-secondary" aria-hidden>
              {[0, 5_000, 10_000, 15_000, 20_000].map((v) => (
                <span key={v}>{inr(v)}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Try</span>
            <Preset onClick={() => chooseSaving(saving + 1000)}>+ ₹1,000</Preset>
            <Preset onClick={() => chooseSaving(Math.max(currentSaving * 2, STEP))}>Double today&apos;s saving</Preset>
            {first.goalNeeds ? <Preset onClick={() => chooseSaving(first.goalNeeds!.monthly)}>Reach my {first.goalNeeds.title} on time ({inr(first.goalNeeds.monthly)})</Preset> : null}
            <Preset onClick={() => chooseSaving(currentSaving)}>Back to today&apos;s {inr(currentSaving)}</Preset>
          </div>
          <p className="tabular text-xs text-secondary">Your real average over the last 3 months is {inr(currentSaving)} a month.</p>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card className="space-y-5">
          <h2 className="font-headline text-lg font-bold text-on-surface">Tune your scenario</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-on-surface">How far ahead</p>
              <Segmented
                label="Years ahead"
                value={String(years) as (typeof YEAR_CHOICES)[number]}
                onChange={(v) => {
                  setYears(Number(v));
                  void commit({ years: Number(v) });
                }}
                options={YEAR_CHOICES.map((y) => ({ id: y, label: `${y} ${y === "1" ? "year" : "years"}` }))}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-on-surface">Return you assume</p>
              <Segmented
                label="Assumed annual return"
                value={String(returnPct) as (typeof RETURN_CHOICES)[number]["id"]}
                onChange={(v) => {
                  setReturnPct(Number(v));
                  void commit({ annualReturnPct: Number(v) });
                }}
                options={RETURN_CHOICES.map((r) => ({ id: r.id, label: r.label }))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface" htmlFor="lump">
                Lump sum today (a bonus, a gift)
              </label>
              <input
                id="lump"
                className={cx(inputCls, "tabular")}
                inputMode="numeric"
                placeholder="₹ 0"
                value={lumpText}
                onChange={(e) => setLumpText(e.target.value)}
                onBlur={() => void commit({ lumpSum: lump })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {LUMP_CHIPS.map((c) => (
                  <Preset
                    key={c}
                    onClick={() => {
                      setLumpText(c === 0 ? "" : String(c));
                      void commit({ lumpSum: c });
                    }}
                  >
                    {c === 0 ? "None" : inr(c)}
                  </Preset>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 flex items-baseline justify-between text-sm font-medium text-on-surface" htmlFor="stepup">
                <span>Raise my saving every year</span>
                <span className="tabular font-headline text-lg font-extrabold">{stepUp}%</span>
              </label>
              <input
                id="stepup"
                type="range"
                min={0}
                max={20}
                step={5}
                value={stepUp}
                onChange={(e) => setStepUp(Number(e.target.value))}
                onPointerUp={(e) => void commit({ stepUpPct: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => void commit({ stepUpPct: Number((e.target as HTMLInputElement).value) })}
                className="w-full"
              />
              <p className="mt-1 text-xs text-secondary">Like a yearly increment: save {stepUp}% more each year than the year before.</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={real}
            onClick={() => {
              setReal(!real);
              void commit({ real: !real });
            }}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-ink/20 p-3 text-left transition-colors hover:border-ink"
          >
            <span className={cx("relative h-6 w-11 shrink-0 rounded-full border-2 border-ink transition-colors", real ? "bg-primary" : "bg-surface-container")}>
              <motion.span className="absolute top-0.5 h-4 w-4 rounded-full border-2 border-ink bg-surface-container-lowest" animate={{ left: real ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-on-surface">Show it in today&apos;s rupees</span>
              <span className="block text-xs text-secondary">Adjusts for {Math.round(INFLATION * 100)}% yearly inflation, so ₹1,00,000 later is compared with what it can buy now.</span>
            </span>
          </button>
        </Card>
      </Reveal>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal index={2}>
          <Card hero className="h-full">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-ink bg-now" aria-hidden />
              <Eyebrow>Current path in {plural(years, "year")}</Eyebrow>
            </div>
            <p className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              <CountUp value={end.current} format={money} duration={0.5} />
            </p>
            <p className="tabular mt-1 text-xs text-secondary">Based on {inr(currentSaving)} a month, nothing else changes</p>
          </Card>
        </Reveal>
        <Reveal index={3}>
          <Card hero className="h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-ink bg-future" aria-hidden />
                <Eyebrow>Chosen path in {plural(years, "year")}</Eyebrow>
              </div>
              {difference > 0 ? <span className="sticker bg-future text-white">+{inr(difference)}</span> : null}
            </div>
            <p className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              <CountUp value={end.chosen} format={money} duration={0.5} />
            </p>
            <p className="tabular mt-1 text-xs text-secondary">
              {inr(saving)} a month{lump > 0 ? ` + ${inr(lump)} today` : ""}
              {stepUp > 0 ? `, raised ${stepUp}% a year` : ""}
            </p>
          </Card>
        </Reveal>
        <Reveal index={4}>
          <Card className="h-full">
            <Eyebrow>Where the chosen path comes from</Eyebrow>
            {real ? (
              <p className="mt-3 text-sm text-secondary">Switch off “today&apos;s rupees” to see how much is your money and how much is growth.</p>
            ) : (
              <>
                <div className="mt-3 flex h-5 overflow-hidden rounded-full border-2 border-ink" role="img" aria-label={`You put in ${inr(putIn)}, growth adds ${inr(growth)}`}>
                  <motion.div className="h-full bg-on-surface" initial={false} animate={{ width: `${(putIn / Math.max(1, putIn + growth)) * 100}%` }} transition={{ duration: 0.6 }} />
                  <motion.div className="h-full bg-primary" initial={false} animate={{ width: `${(growth / Math.max(1, putIn + growth)) * 100}%` }} transition={{ duration: 0.6 }} />
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-2 text-secondary">
                      <span className="h-2.5 w-2.5 rounded-sm bg-on-surface" aria-hidden />
                      You put in
                    </dt>
                    <dd className="tabular font-semibold text-on-surface">{inr(putIn)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-2 text-secondary">
                      <span className="h-2.5 w-2.5 rounded-sm border border-ink bg-primary" aria-hidden />
                      Growth ({returnPct}%)
                    </dt>
                    <dd className="tabular font-semibold text-on-surface">{inr(growth)}</dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
        </Reveal>
      </section>

      {milestones.length > 0 ? (
        <Reveal index={5}>
          <Card>
            <h2 className="font-headline text-lg font-bold text-on-surface">The life you unlock</h2>
            <p className="mt-0.5 text-sm text-secondary">When each one becomes possible, today&apos;s path against your chosen one.</p>
            <ul className="mt-4 divide-y divide-surface-container-high">
              {milestones.map((m, i) => {
                const sooner = m.monthsCurrent !== null && m.monthsChosen !== null ? m.monthsCurrent - m.monthsChosen : null;
                return (
                  <motion.li
                    key={m.id}
                    className="py-4"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-headline text-base font-bold text-on-surface">{m.title}</p>
                      <p className="tabular text-sm font-semibold text-secondary">{inr(m.target)}</p>
                    </div>
                    <Track years={years} current={m.monthsCurrent} chosen={m.monthsChosen} />
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5 text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full bg-now" aria-hidden />
                        Today&apos;s path: <strong className="text-on-surface">{when(m.monthsCurrent, years)}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full bg-future" aria-hidden />
                        Your plan: <strong className="text-on-surface">{when(m.monthsChosen, years)}</strong>
                      </span>
                      {sooner !== null && sooner > 0 ? <span className="sticker bg-primary text-on-primary">{plural(sooner, "month")} sooner</span> : null}
                      {m.monthsCurrent === null && m.monthsChosen !== null ? <span className="sticker bg-future text-white">Only with your plan</span> : null}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      ) : null}

      <Reveal index={6}>
        <Card>
          <ChartFrame
            title={`Projected balance over ${plural(years, "year")}`}
            chart={<ProjectionChart data={points} years={years} marks={marks} />}
            table={<ProjectionTable data={points} years={years} />}
          />
          <p className="mt-2 text-xs text-secondary">
            Assumes a {returnPct}% annual return
            {real ? ` and ${Math.round(INFLATION * 100)}% inflation` : ""}
            {stepUp > 0 ? `, and a ${stepUp}% raise in your saving each year` : ""}. These are assumptions, not promises.
          </p>
        </Card>
      </Reveal>

      <Reveal index={7}>
        <Card className="border-l-[6px] !border-l-future">
          <span className="sticker bg-future text-white">{t("future_message", { years })}</span>
          <div className="mt-3 min-h-[5rem]" aria-live="polite">
            {thinking ? (
              <div className="space-y-2" aria-label="Writing your message">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ) : narrativeError ? (
              <p className="text-sm text-secondary">The message could not be written right now. Change a control again to retry.</p>
            ) : (
              <Typewriter key={narrative ?? ""} text={cleanAiText(narrative ?? "")} className="text-base leading-relaxed text-on-surface" />
            )}
          </div>
        </Card>
      </Reveal>

      <Reveal index={8}>
        <WhatIf />
      </Reveal>
      <Disclaimer />
    </>
  );
}

function Preset({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 border-ink/25 bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface transition-all hover:border-ink active:scale-95"
    >
      {children}
    </button>
  );
}

/** A 0..N year track with a dot where each path reaches the target. Dots glide when the scenario changes. */
function Track({ years, current, chosen }: { years: number; current: number | null; chosen: number | null }) {
  const total = years * 12;
  const pct = (m: number) => `${Math.min(100, (m / total) * 100)}%`;
  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-full border-2 border-ink bg-surface-container" role="img" aria-label="Timeline of when each path reaches the target">
        {current !== null ? (
          <motion.span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-now" initial={false} animate={{ left: pct(current) }} transition={{ type: "spring", stiffness: 180, damping: 22 }} />
        ) : null}
        {chosen !== null ? (
          <motion.span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-future" initial={false} animate={{ left: pct(chosen) }} transition={{ type: "spring", stiffness: 180, damping: 22 }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-secondary" aria-hidden>
        <span>Today</span>
        <span>{plural(years, "year")}</span>
      </div>
    </div>
  );
}

/* ---------- what-if ---------- */

type WhatIfResult = {
  budgetImpact: { monthlyCost: number; months: number; totalCost: number; averageSavingBefore: number; averageSavingAfter: number; shortfallPerMonth: number };
  goalDelays: { goalId: string; title: string; monthsCurrent: number | null; monthsAfter: number | null; delayMonths: number | null }[];
  narrative: string;
};

/** Pulls "₹2,500" and "12 months" out of a sentence. Plain code, so the numbers are never guessed. */
function parseWhatIf(text: string): { monthlyCost: number; months: number } | null {
  const cost = /₹\s*([\d,]+)|rs\.?\s*([\d,]+)|\b([\d,]{3,})\b/i.exec(text);
  const months = /(\d+)\s*(?:months?|mahin[ae]|mo\b)/i.exec(text) ?? /\bfor\s+(\d+)\b/i.exec(text);
  if (!cost || !months) return null;
  const monthlyCost = Number((cost[1] ?? cost[2] ?? cost[3]).replace(/,/g, ""));
  const n = Number(months[1]);
  return monthlyCost > 0 && n > 0 ? { monthlyCost, months: n } : null;
}

function WhatIf() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);

  async function run() {
    setError(null);
    const parsed = parseWhatIf(text);
    if (!parsed) return setError("Include the monthly cost and the number of months, for example: phone on EMI ₹2,500 for 12 months.");
    setBusy(true);
    try {
      setResult(await api<WhatIfResult>("/whatif", { json: { description: text.trim().slice(0, 120), ...parsed } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-headline text-base font-semibold text-on-surface">What-if</h2>
      <p className="mt-0.5 text-sm text-secondary">See what a new monthly cost does to your savings and goals before you commit.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && !busy && run()}
          placeholder="What if I take a phone on EMI: ₹2,500 for 12 months?"
          maxLength={120}
          aria-label="What-if scenario"
        />
        <Button variant="outline" onClick={run} disabled={busy || !text.trim()} className="shrink-0">
          {busy ? "Running…" : "Run what-if"}
        </Button>
      </div>
      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="New monthly cost" value={inr(result.budgetImpact.monthlyCost)} note={`for ${plural(result.budgetImpact.months, "month")}, ${inr(result.budgetImpact.totalCost)} in total`} />
            <Stat label="Your saving today" value={inr(result.budgetImpact.averageSavingBefore)} note="average, last 3 months" />
            <Stat label="Saving after" value={inr(result.budgetImpact.averageSavingAfter)} note={result.budgetImpact.shortfallPerMonth > 0 ? `${inr(result.budgetImpact.shortfallPerMonth)} a month short` : "still positive"} warn={result.budgetImpact.shortfallPerMonth > 0} />
          </dl>
          {result.goalDelays.length > 0 ? (
            <ul className="divide-y divide-surface-container-low rounded-lg border-[1.5px] border-outline-variant">
              {result.goalDelays.map((g) => (
                <li key={g.goalId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="font-medium text-on-surface">{g.title}</span>
                  <span className="tabular text-secondary">
                    {g.monthsCurrent === null || g.monthsAfter === null ? "cannot be reached at this saving" : `${g.monthsCurrent} → ${g.monthsAfter} months`}
                    {g.delayMonths !== null && g.delayMonths > 0 ? <strong className="ml-2 text-error">+{plural(g.delayMonths, "month")}</strong> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <RichText text={result.narrative} className="space-y-2 text-sm leading-relaxed text-on-surface" />
        </div>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border-[1.5px] border-outline-variant p-3">
      <dt className="font-headline text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</dt>
      <dd className={cx("mt-1 font-headline text-xl font-extrabold", warn ? "text-error" : "text-on-surface")}>{value}</dd>
      <p className="tabular mt-0.5 text-xs text-secondary">{note}</p>
    </div>
  );
}
