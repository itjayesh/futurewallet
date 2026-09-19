"use client";

import { ArrowRight, Clock, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { CategoryDonut, ChartFrame, TrendChart, TrendTable } from "@/components/charts";
import { CountUp, motion, Reveal, useReducedMotion } from "@/components/motion";
import RichText from "@/components/RichText";
import { Card, CardTitle, Disclaimer, ErrorState, Eyebrow, ProgressBar, Skeleton, type Tone } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import type { Summary } from "@/lib/client/types";
import type { Trigger, Personality } from "@/lib/services/patterns";
import { inr, plural } from "@/lib/format";

const money = (n: number) => inr(n);
const whole = (n: number) => String(Math.round(n));

export default function DashboardPage() {
  const { data, error, reload } = useApi<Summary>("/summary");
  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <DashboardSkeleton />;
  return <Dashboard s={data} />;
}

function Dashboard({ s }: { s: Summary }) {
  const { t } = useApp();
  const empty = s.byCategory.length === 0;
  return (
    <>
      <Reveal index={0}>
        <p className="sticker mb-4 bg-surface-container-lowest">{t("greeting")}{s.name ? `, ${s.name}` : ""}</p>
        <WrappedBanner monthName={s.monthLabel.split(" ")[0]} />
      </Reveal>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Reveal index={1}><HealthCard s={s} /></Reveal>
        <Reveal index={2}><SpentCard s={s} /></Reveal>
        <Reveal index={3}><SavedCard s={s} /></Reveal>
      </section>

      {empty ? (
        <Card className="text-center">
          <p className="font-headline text-base font-semibold text-on-surface">No expenses this month yet</p>
          <p className="mt-1 text-sm text-secondary">Log one in a few words, for example “kal Zomato pe 450 diye”.</p>
          <Link href="/add" className="btn btn-primary mt-4">
            Add an expense
          </Link>
        </Card>
      ) : (
        <>
          <Reveal index={4}>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle aside={`Total: ${inr(s.total)}`}>{t("by_category")}</CardTitle>
              <CategoryDonut data={s.byCategory} total={s.total} />
            </Card>
            <Card>
              <ChartFrame
                title={t("trend6")}
                chart={<TrendChart data={s.trend} budget={s.budgetTotal} partialLabel={s.trend[s.trend.length - 1].label} />}
                table={<TrendTable data={s.trend} budget={s.budgetTotal} />}
              />
            </Card>
          </section>
          </Reveal>

          <Reveal index={5}>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-headline text-base font-semibold text-on-surface">{t("top_merchants")}</h2>
                <span className="text-xs text-secondary">{s.monthLabel}</span>
              </div>
              {s.topMerchants.length === 0 ? (
                <p className="text-sm text-secondary">No merchants recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant font-headline text-xs text-secondary">
                      <th className="pb-2 text-left font-medium">Merchant</th>
                      <th className="pb-2 text-left font-medium">Activity</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {s.topMerchants.map((m, i) => (
                      <motion.tr key={m.merchant} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}>
                        <td className="flex items-center gap-2 py-2.5 font-medium text-on-surface">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-surface-container text-[10px] font-bold text-secondary" aria-hidden>
                            {m.merchant[0]?.toUpperCase()}
                          </span>
                          {m.merchant}
                        </td>
                        <td className="tabular py-2.5 text-xs text-secondary">{plural(m.count, "transaction")}</td>
                        <td className="tabular py-2.5 text-right font-medium text-on-surface">{inr(m.amount)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <InsightCard initial={s.insight?.body ?? null} />
          </section>
          </Reveal>

          <Reveal index={6}>
            <PatternsSection />
          </Reveal>
        </>
      )}
      <Disclaimer />
    </>
  );
}

function HealthCard({ s }: { s: Summary }) {
  const { t } = useApp();
  const reduce = useReducedMotion();
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <Card hero className="flex h-full flex-col justify-between">
      <Eyebrow>{t("financial_health")}</Eyebrow>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" role="img" aria-label={`Health score ${s.healthScore} out of 100`}>
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-container-high)" strokeWidth="8" />
            <motion.circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="var(--now)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={reduce ? false : { strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - s.healthScore / 100) }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-xl font-bold leading-none text-on-surface"><CountUp value={s.healthScore} format={whole} /></span>
            <span className="mt-0.5 text-[10px] text-secondary">/ 100</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-secondary">{s.healthReason}</p>
      </div>
    </Card>
  );
}

function SpentCard({ s }: { s: Summary }) {
  const { t } = useApp();
  const hasBudget = s.budgetTotal > 0;
  const pct = hasBudget ? Math.round((s.total / s.budgetTotal) * 100) : 0;
  const over = hasBudget && s.total > s.budgetTotal;
  const tone: Tone = over ? "error" : pct >= 80 ? "warning" : "primary";
  return (
    <Card hero className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-baseline justify-between">
          <Eyebrow>{t("spent_vs_budget")}</Eyebrow>
          {hasBudget ? <span className="tabular text-xs font-medium text-secondary">{pct}% spent</span> : null}
        </div>
        <div className="mt-3">
          <div className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
            <CountUp value={s.total} format={money} />
            {hasBudget ? <span className="ml-1 text-sm font-normal text-secondary">of {inr(s.budgetTotal)}</span> : null}
          </div>
          {hasBudget ? (
            <div className="mt-4">
              <ProgressBar pct={pct} tone={tone} label="Share of budget spent" />
            </div>
          ) : null}
        </div>
      </div>
      <p className="tabular mt-3 text-xs text-secondary">
        {!hasBudget ? (
          <>
            No budget yet. <Link href="/budget" className="font-semibold text-on-surface underline underline-offset-2">Set one up</Link>
          </>
        ) : over ? (
          <span className="font-medium text-error">{inr(s.total - s.budgetTotal)} over budget</span>
        ) : (
          `${inr(s.budgetTotal - s.total)} left, ${plural(s.daysLeft, "day")} to go`
        )}
      </p>
    </Card>
  );
}

function SavedCard({ s }: { s: Summary }) {
  const { t } = useApp();
  return (
    <Card hero className="flex h-full flex-col justify-between">
      <div>
        <Eyebrow>{t("saved_so_far")}</Eyebrow>
        <div className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface"><CountUp value={s.saved} format={money} /></div>
      </div>
      <p className="tabular mt-3 text-xs text-secondary">Average over the last 3 months: {inr(s.avgSaving)}</p>
    </Card>
  );
}

function InsightCard({ initial }: { initial: string | null }) {
  const { personaVersion, t } = useApp();
  const [body, setBody] = useState(initial);
  const [failed, setFailed] = useState(false);
  const seen = useRef(personaVersion);

  useEffect(() => {
    // Write one when there is none yet, and again whenever the advisor style changes.
    if (body !== null && seen.current === personaVersion) return;
    seen.current = personaVersion;
    let cancelled = false;
    setFailed(false);
    api<{ insight: { body: string } }>("/insights/refresh", { method: "POST" })
      .then((r) => !cancelled && setBody(r.insight.body))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [body, personaVersion]);

  return (
    <Card hero className="flex flex-col justify-between !bg-primary text-on-primary lg:col-span-5 lg:-rotate-1">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="font-headline text-xs font-semibold uppercase tracking-wider text-on-primary">{t("insight_title")}</span>
        </div>
        <div className="mt-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4" aria-live="polite">
          {body ? (
            <RichText text={body} className="space-y-2 text-sm leading-relaxed text-on-surface" />
          ) : failed ? (
            <p className="text-sm text-secondary">The insight could not be written right now. Try again in a moment.</p>
          ) : (
            <div className="space-y-2" aria-label="Writing insight">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <Link
          href={`/advisor?ask=${encodeURIComponent(body ? `Tell me more about this: ${body}` : "Where can I save?")}`}
          className="group inline-flex items-center gap-2 font-headline text-sm font-bold text-on-primary underline underline-offset-4"
        >
          {t("ask_about_this")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/** Why the spending happens, and who the spender is. Both come from code over the last 90 days. */
function PatternsSection() {
  const { t } = useApp();
  const triggers = useApi<{ triggers: Trigger[] }>("/triggers");
  const personality = useApi<{ personality: Personality }>("/personality");
  const p = personality.data?.personality;

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardTitle aside="Last 90 days">{t("triggers")}</CardTitle>
        {!triggers.data ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : triggers.data.triggers.length === 0 ? (
          <p className="text-sm text-secondary">No strong timing pattern yet. Keep logging and this will tell you when and why the money goes.</p>
        ) : (
          <ul className="space-y-3">
            {triggers.data.triggers.map((t) => (
              <li key={t.id} className="rounded-lg border-[1.5px] border-outline-variant p-3">
                <p className="flex items-start gap-2 font-headline text-sm font-bold text-on-surface">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {t.headline}
                </p>
                <p className="mt-0.5 pl-6 text-xs text-secondary">{t.detail}</p>
                <p className="mt-2 pl-6 text-sm text-on-surface">
                  <span className="sticker mr-2 bg-primary text-on-primary">Try this</span>
                  {t.nudge}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card hero className="flex flex-col justify-between lg:col-span-5">
        <div>
          <span className="sticker bg-primary text-on-primary">{t("personality")}</span>
          {p ? (
            <>
              <p className="mt-3 font-headline text-3xl font-extrabold leading-tight tracking-tight text-on-surface">{p.title}</p>
              <p className="mt-1 text-sm text-secondary">{p.tagline}</p>
            </>
          ) : (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
        </div>
        <Link href="/personality" className="group mt-4 inline-flex items-center gap-2 font-headline text-sm font-bold text-on-surface underline underline-offset-4">
          {t("see_card")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </Card>
    </section>
  );
}

/** Big invitation to the Wrapped popup. Fixed colours on purpose: it should look like its own thing in both themes. */
function WrappedBanner({ monthName }: { monthName: string }) {
  const { openWrapped, t } = useApp();
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-[#15130f] bg-[#15130f] p-6 text-[#f7f3ea] shadow-[4px_4px_0_var(--pop-shadow)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div>
        <span className="inline-block -rotate-2 rounded-md border-2 border-[#15130f] bg-[#ff3d8b] px-2 py-0.5 font-headline text-xs font-extrabold uppercase tracking-wider text-[#15130f]">New</span>
        <h2 className="mt-2 font-headline text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {t("wrapped_ready", { month: monthName })
            .split(/(Wrapped|रैप्ड)/)
            .map((part, i) => (part === "Wrapped" || part === "रैप्ड" ? <span key={i} className="text-[#c8f03c]">{part}</span> : part))}
        </h2>
        <p className="mt-1 text-[#f7f3ea]/75">{t("wrapped_sub")}</p>
      </div>
      <button
        type="button"
        onClick={openWrapped}
        className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[#f7f3ea] bg-[#c8f03c] px-6 font-headline text-lg font-extrabold text-[#15130f] shadow-[4px_4px_0_#f7f3ea] transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <Play className="h-5 w-5 fill-current" aria-hidden />
        {t("play_wrapped")}
      </button>
    </div>
  );
}
