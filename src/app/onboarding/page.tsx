"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Persona } from "@/components/AppShell";
import { Pop, Reveal } from "@/components/motion";
import { Button, Card, cx, Disclaimer, Field, inputCls, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { inr, parseNumber } from "@/lib/format";

const PERSONAS: { id: Persona; label: string; example: string }[] = [
  { id: "friendly", label: "Friendly", example: "Nice month. Food ran a bit high, so let us trim ₹800 there." },
  { id: "roast", label: "Roast", example: "11 Zomato orders? Cap it at 6 and keep ₹1,800." },
  { id: "coach", label: "Coach", example: "Food is 38% of spend against a 25% target. Reduce by ₹1,800." },
];

type FixedRow = { name: string; amount: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [income, setIncome] = useState("");
  const [fixed, setFixed] = useState<FixedRow[]>([{ name: "Rent", amount: "" }]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [persona, setPersona] = useState<Persona>("friendly");
  const [busy, setBusy] = useState<"continue" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setRow = (i: number, patch: Partial<FixedRow>) => setFixed((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit() {
    setError(null);
    const incomeValue = parseNumber(income);
    if (!name.trim()) return setError("Enter your name.");
    if (!(incomeValue > 0)) return setError("Enter your monthly income.");
    const fixedCosts = fixed.filter((r) => r.name.trim() || r.amount.trim()).map((r) => ({ name: r.name.trim(), amount: parseNumber(r.amount) }));
    if (fixedCosts.some((f) => !f.name || Number.isNaN(f.amount))) return setError("Give every fixed cost a name and an amount.");
    if (fixedCosts.reduce((s, f) => s + f.amount, 0) > incomeValue) return setError("Fixed costs cannot be more than your income.");
    const wantsGoal = goalTitle.trim() || goalTarget.trim() || goalDeadline;
    if (wantsGoal && (!goalTitle.trim() || !(parseNumber(goalTarget) > 0) || !goalDeadline)) {
      return setError("For a goal, fill in the title, the target amount and the deadline, or clear all three.");
    }

    setBusy("continue");
    try {
      await api("/profile", { method: "PUT", json: { name: name.trim(), income: incomeValue, fixedCosts, persona } });
      if (wantsGoal) await api("/goals", { json: { title: goalTitle.trim(), target: parseNumber(goalTarget), deadline: goalDeadline } });
      await api("/budget/generate", { json: {} });
      router.push("/dashboard");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  async function loadDemo() {
    setError(null);
    setBusy("demo");
    try {
      await api("/demo/seed", { method: "POST" });
      if (persona !== "friendly") await api("/profile", { method: "PUT", json: { persona } });
      router.push("/dashboard");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-primary font-headline text-base font-extrabold text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]">FW</div>
        <span className="font-headline text-lg font-bold tracking-tight text-on-surface">FutureWallet</span>
      </div>

      <Reveal>
      <Card hero className="space-y-8 p-6 sm:p-8">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">Set up your profile</h1>
          <p className="mt-1 text-sm text-secondary">This takes about a minute.</p>
        </div>

        <div className="space-y-4">
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Monthly income (₹)">
            <input className={cx(inputCls, "tabular")} inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="45,000" />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-on-surface">Fixed monthly costs</legend>
          <div className="space-y-2">
            {fixed.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label="Cost name" className={inputCls} value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Rent" />
                <input
                  aria-label="Cost amount in rupees"
                  className={cx(inputCls, "tabular !w-32 shrink-0")}
                  inputMode="numeric"
                  value={row.amount}
                  onChange={(e) => setRow(i, { amount: e.target.value })}
                  placeholder="16,000"
                />
                <button
                  type="button"
                  aria-label={`Remove ${row.name || "cost"}`}
                  onClick={() => setFixed((rows) => rows.filter((_, j) => j !== i))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-low hover:text-on-surface"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <Button variant="text" className="mt-2" onClick={() => setFixed((rows) => [...rows, { name: "", amount: "" }])}>
            <Plus className="h-4 w-4" aria-hidden />
            Add fixed cost
          </Button>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-on-surface">Dream goal <span className="font-normal text-secondary">(optional)</span></legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Title">
              <input className={inputCls} value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Laptop" />
            </Field>
            <Field label="Target (₹)">
              <input className={cx(inputCls, "tabular")} inputMode="numeric" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="60,000" />
            </Field>
            <Field label="Deadline">
              <input className={inputCls} type="date" min={tomorrow} value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-on-surface">Advisor style</legend>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Advisor style">
            {PERSONAS.map((p) => {
              const selected = persona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPersona(p.id)}
                  className={cx(
                    "rounded-lg border p-3 text-left transition-colors",
                    selected ? "pop-card bg-primary text-on-primary" : "border-2 border-ink/20 hover:border-ink",
                  )}
                >
                  <span className="block font-headline text-sm font-semibold text-on-surface">{p.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-secondary">{p.example}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error ? (
          <Pop key={error}>
            <Notice tone="error">{error}</Notice>
          </Pop>
        ) : null}

        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="sm:flex-1" onClick={submit} disabled={busy !== null}>
              {busy === "continue" ? "Setting up…" : "Continue"}
            </Button>
            <Button variant="outline" className="sm:flex-1" onClick={loadDemo} disabled={busy !== null}>
              {busy === "demo" ? "Loading…" : "Load demo data"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-secondary">Demo data fills the app with 6 months of sample transactions, a budget and two goals ({inr(45_000)} monthly income).</p>
        </div>
      </Card>
      </Reveal>
      <Disclaimer />
    </main>
  );
}
