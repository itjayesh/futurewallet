"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, cx, Disclaimer, ErrorState, Field, inputCls, Notice, ProgressBar, Skeleton, TEXT_TONE } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Pop, Reveal } from "@/components/motion";
import { api, errorMessage, useApi } from "@/lib/client/api";
import type { GoalRow } from "@/lib/client/types";
import { formatDate, inr, parseNumber } from "@/lib/format";

export default function GoalsPage() {
  const { t } = useApp();
  const { data, error, reload } = useApi<{ goals: GoalRow[]; averageSaving: number }>("/goals");
  const [creating, setCreating] = useState(false);

  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">Progress is measured against your average monthly saving over the last 3 months.</p>
        <Button onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("new_goal")}
        </Button>
      </div>

      {creating ? (
        <Pop>
          <NewGoal
            onDone={() => {
              setCreating(false);
              reload();
            }}
          />
        </Pop>
      ) : null}

      {data.goals.length === 0 ? (
        <Card className="text-center">
          <p className="font-headline text-base font-semibold text-on-surface">No goals yet</p>
          <p className="mt-1 text-sm text-secondary">Add something to save for, like a laptop or an emergency fund.</p>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.goals.map((g, i) => (
            <Reveal key={g.id} index={i}>
              <GoalCard goal={g} averageSaving={data.averageSaving} onChange={reload} />
            </Reveal>
          ))}
        </section>
      )}
      <Disclaimer />
    </>
  );
}

function GoalCard({ goal, averageSaving, onChange }: { goal: GoalRow; averageSaving: number; onChange: () => void }) {
  const { t } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { plan } = goal;
  const done = goal.saved_amount >= goal.target_amount;
  const pct = Math.round((goal.saved_amount / goal.target_amount) * 100);

  async function contribute() {
    const value = parseNumber(amount);
    if (!(value > 0)) return setError("Enter an amount.");
    setBusy(true);
    setError(null);
    try {
      await api(`/goals/${goal.id}/contribute`, { json: { amount: value } });
      setAmount("");
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api(`/goals/${goal.id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      setError(errorMessage(e));
      setConfirmDelete(false);
    }
  }

  const statusTone = done || plan.onTrack ? "success" : "error";
  const statusLabel = done ? "Goal reached" : plan.onTrack ? "On track" : "Off track";

  return (
    <Card className="flex h-full flex-col transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-lg font-semibold text-on-surface">{goal.title}</h2>
          <p className="tabular mt-0.5 text-sm text-secondary">
            {inr(goal.saved_amount)} of {inr(goal.target_amount)} · by {formatDate(goal.deadline)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cx("text-sm font-semibold", TEXT_TONE[statusTone])}>{statusLabel}</span>
          <button
            type="button"
            aria-label={`Delete goal ${goal.title}`}
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-secondary hover:bg-surface-container hover:text-error"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {confirmDelete ? (
        <Pop className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border-2 border-error bg-error-container p-2.5 text-sm text-error">
          <span className="font-medium">Delete “{goal.title}”? This cannot be undone.</span>
          <button type="button" onClick={remove} className="rounded-md border-2 border-error bg-error px-2.5 py-0.5 font-bold text-white">
            {t("confirm_yes")}
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border-2 border-ink/30 px-2.5 py-0.5 font-bold text-on-surface">
            {t("cancel")}
          </button>
        </Pop>
      ) : null}

      <div className="mt-4">
        <ProgressBar pct={pct} label={`${goal.title} progress`} />
        <p className="tabular mt-1 text-xs text-secondary">{Math.min(pct, 100)}% saved</p>
      </div>

      {!done ? (
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-secondary">Needed per month</dt>
            <dd className="tabular font-medium text-on-surface">{inr(plan.monthlyNeeded)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-secondary">Your average saving</dt>
            <dd className="tabular font-medium text-on-surface">{inr(averageSaving)}</dd>
          </div>
        </dl>
      ) : null}

      {!done && !plan.onTrack && plan.suggestion ? (
        <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <p className="font-headline text-xs font-semibold uppercase tracking-wider text-secondary">Advisor tip</p>
          <p className="mt-1 text-sm text-on-surface">
            {plan.suggestion.closesGap
              ? `Cut ${plan.suggestion.category} by ${inr(plan.suggestion.amount)} a month to close the ${inr(plan.gap)} gap.`
              : `Cutting ${plan.suggestion.category} by ${inr(plan.suggestion.amount)} a month closes part of the ${inr(plan.gap)} gap. You will need another cut too.`}
          </p>
        </div>
      ) : null}

      {!done && !plan.onTrack && !plan.suggestion ? (
        <div className="mt-4">
          <Notice>To close the {inr(plan.gap)} monthly gap, save more each month or move the deadline.</Notice>
        </div>
      ) : null}

      {!done ? (
        <div className="mt-auto pt-5">
          <div className="flex gap-2">
            <input
              aria-label={`Amount to add to ${goal.title}`}
              className={cx(inputCls, "tabular")}
              inputMode="numeric"
              placeholder="₹ amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && contribute()}
            />
            <Button variant="outline" onClick={contribute} disabled={busy || !amount.trim()} className="shrink-0">
              {t("add_contribution")}
            </Button>
          </div>
          {error ? <p className="mt-2 text-xs text-error">{error}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function NewGoal({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  async function create() {
    if (!title.trim()) return setError("Give the goal a name.");
    if (!(parseNumber(target) > 0)) return setError("Enter the target amount.");
    if (!deadline) return setError("Pick a deadline.");
    setBusy(true);
    setError(null);
    try {
      await api("/goals", { json: { title: title.trim(), target: parseNumber(target), deadline } });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 font-headline text-base font-semibold text-on-surface">New goal</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Laptop" maxLength={80} autoFocus />
        </Field>
        <Field label="Target (₹)">
          <input className={cx(inputCls, "tabular")} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="60,000" />
        </Field>
        <Field label="Deadline">
          <input className={inputCls} type="date" min={tomorrow} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex gap-3">
        <Button onClick={create} disabled={busy}>
          {busy ? "Saving…" : "Save goal"}
        </Button>
        <Button variant="text" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
