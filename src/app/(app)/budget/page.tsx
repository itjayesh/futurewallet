"use client";

import { Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, cx, Disclaimer, ErrorState, Eyebrow, Notice, ProgressBar, Skeleton, TEXT_TONE, type Tone } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { CountUp, motion, Reveal } from "@/components/motion";
import { api, errorMessage, useApi } from "@/lib/client/api";
import type { BudgetView } from "@/lib/client/types";
import { inr } from "@/lib/format";

type Line = { category: string; limit: number; reason: string; spent: number; usedPct: number };

const STEP = 100;

/** Colour is always paired with a text label, and a fixed cost at its limit is expected, not a warning. */
function status(line: Line, fixed: boolean): { tone: Tone; label: string } {
  if (line.usedPct >= 100 && !fixed) return { tone: "error", label: "Over limit" };
  if (fixed && line.usedPct <= 100) return { tone: "neutral", label: "Fixed cost" };
  if (line.usedPct >= 80) return { tone: "warning", label: line.usedPct >= 100 ? "Over limit" : "Approaching limit" };
  return { tone: "primary", label: "On track" };
}

export default function BudgetPage() {
  const { data, error, reload } = useApi<BudgetView>("/budgets");
  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  return <Budget view={data} reload={reload} />;
}

function Budget({ view, reload }: { view: BudgetView; reload: () => Promise<void> }) {
  const { t } = useApp();
  const editable = view.budgets.filter((b) => b.category !== "Savings");
  const [lines, setLines] = useState<Line[]>(editable);
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Take in fresh server data (after Generate or a reload) unless the user is mid-edit.
  useEffect(() => {
    if (!dirty.current) setLines(view.budgets.filter((b) => b.category !== "Savings"));
  }, [view]);

  const total = lines.reduce((s, l) => s + l.limit, 0);
  const savings = view.income - total;

  const persist = useCallback(
    async (next: Line[]) => {
      setSaveState("saving");
      setError(null);
      try {
        await api("/budgets", { method: "PUT", json: { budgets: next.map(({ category, limit, reason }) => ({ category, limit, reason })) } });
        dirty.current = false;
        setSaveState("saved");
        await reload();
      } catch (e) {
        setError(errorMessage(e));
        setSaveState("idle");
      }
    },
    [reload],
  );

  function change(category: string, limit: number) {
    dirty.current = true;
    setSaveState("idle");
    const next = lines.map((l) => (l.category === category ? { ...l, limit } : l));
    setLines(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 500);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      dirty.current = false;
      await api("/budget/generate", { json: {} });
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  const fixed = new Set(view.fixedCategories);
  const hasBudget = lines.length > 0;

  return (
    <>
      <Reveal index={0}>
      <Card hero>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <dl className="grid grid-cols-3 gap-6">
            <div>
              <dt><Eyebrow>Monthly income</Eyebrow></dt>
              <dd className="mt-1 font-headline text-xl font-bold text-on-surface"><CountUp value={view.income} format={inr} /></dd>
            </div>
            <div>
              <dt><Eyebrow>Total limits</Eyebrow></dt>
              <dd className="mt-1 font-headline text-xl font-bold text-on-surface"><CountUp value={total} format={inr} duration={0.4} /></dd>
            </div>
            <div>
              <dt><Eyebrow>Savings</Eyebrow></dt>
              <dd className={cx("mt-1 font-headline text-xl font-bold", savings < 0 ? "text-error" : "text-on-surface")}><CountUp value={Math.max(0, savings)} format={inr} duration={0.4} /></dd>
            </div>
          </dl>
          <div className="sm:text-right">
            <Button onClick={generate} disabled={generating}>
              {generating ? "Generating…" : hasBudget ? t("regenerate_budget") : t("generate_budget")}
            </Button>
            <p className="mt-1.5 text-xs text-secondary">Limits and savings always add up to your income.</p>
          </div>
        </div>
      </Card>
      </Reveal>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {!hasBudget ? (
        <Card className="text-center">
          <p className="font-headline text-base font-semibold text-on-surface">No budget for this month yet</p>
          <p className="mt-1 text-sm text-secondary">Generate one from your income and fixed costs. You can edit every limit afterwards.</p>
        </Card>
      ) : (
        <Reveal index={1}>
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-headline text-base font-semibold text-on-surface">{t("category_limits")}</h2>
            <span className="text-xs text-secondary" aria-live="polite">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Drag a slider to change a limit"}
            </span>
          </div>
          <div className="mt-3 hidden grid-cols-12 gap-4 border-b border-outline-variant px-5 pb-2 text-xs font-medium text-secondary md:grid">
            <span className="col-span-2">Category</span>
            <span className="col-span-4">Limit</span>
            <span className="col-span-3">Usage</span>
            <span className="col-span-3">Reason</span>
          </div>
          <ul className="divide-y divide-surface-container-low">
            {lines.map((l, i) => {
              const others = total - l.limit;
              const max = Math.max(l.limit, Math.floor((view.income - others) / STEP) * STEP);
              const st = status(l, fixed.has(l.category));
              return (
                <motion.li key={l.category} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-12 md:items-center md:gap-4" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.045, duration: 0.35 }}>
                  <span className="font-medium text-on-surface md:col-span-2">{l.category}</span>
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={max}
                        step={STEP}
                        value={l.limit}
                        onChange={(e) => change(l.category, Number(e.target.value))}
                        aria-label={`${l.category} limit`}
                        className="w-full"
                      />
                      <span className="tabular w-20 shrink-0 text-right text-sm font-medium text-on-surface">{inr(l.limit)}</span>
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <ProgressBar pct={l.limit > 0 ? (l.spent / l.limit) * 100 : l.spent > 0 ? 100 : 0} tone={st.tone} label={`${l.category} used`} />
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="tabular text-secondary">
                        {inr(l.spent)} / {inr(l.limit)}
                      </span>
                      <span className={cx("font-medium", TEXT_TONE[st.tone])}>{st.label}</span>
                    </div>
                  </div>
                  <p className="text-xs text-secondary md:col-span-3">{l.reason || "No reason recorded."}</p>
                </motion.li>
              );
            })}
            <li className="grid grid-cols-1 gap-3 bg-surface-container-low px-5 py-4 md:grid-cols-12 md:items-center md:gap-4">
              <span className="flex items-center gap-1.5 font-medium text-on-surface md:col-span-2">
                <Lock className="h-3.5 w-3.5 text-secondary" aria-hidden />
                Savings
              </span>
              <span className="tabular font-headline text-base font-bold text-on-surface md:col-span-4">{inr(Math.max(0, savings))}</span>
              <span className="text-xs text-secondary md:col-span-3">{view.income > 0 ? Math.round((Math.max(0, savings) / view.income) * 100) : 0}% of income</span>
              <p className="text-xs text-secondary md:col-span-3">Whatever is left after limits, paid to yourself first.</p>
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-outline-variant px-5 py-3 text-xs text-secondary">
            <Legend tone="primary" label="Under 80%" />
            <Legend tone="warning" label="80% to 99%: warning" />
            <Legend tone="error" label="100% or more: over limit" />
          </div>
        </Card>
        </Reveal>
      )}
      <Disclaimer />
    </>
  );
}

const DOT: Record<Tone, string> = { primary: "bg-now", warning: "bg-warning", error: "bg-error", success: "bg-success", neutral: "bg-secondary" };

function Legend({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2 w-2 rounded-full", DOT[tone])} aria-hidden />
      {label}
    </span>
  );
}
