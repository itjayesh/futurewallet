"use client";

import { Loader2, Mic, Square, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useApp } from "@/components/AppShell";
import { AnimatePresence, motion, Pop, Reveal } from "@/components/motion";
import { Button, Card, cx, Disclaimer, Field, inputCls, Notice } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/client/api";
import type { TKey } from "@/lib/client/i18n";
import type { ExpenseRow } from "@/lib/client/types";
import { CATEGORIES } from "@/lib/finance/constants";
import { cleanAiText } from "@/lib/client/aiText";
import { useVoiceEngine } from "@/lib/client/voice/prefs";
import { useVoiceInput } from "@/lib/client/voice/useVoiceInput";
import { formatDayMonth, inr, parseNumber } from "@/lib/format";

type Tab = "type" | "manual" | "csv";
const TABS: { id: Tab; label: TKey }[] = [
  { id: "type", label: "tab_type" },
  { id: "manual", label: "tab_manual" },
  { id: "csv", label: "tab_csv" },
];

const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default function AddExpensePage() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("type");
  const recent = useApi<{ expenses: ExpenseRow[] }>("/expenses");
  const [nudge, setNudge] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  /** After any save: refresh the list and ask for the nudge worth showing (budget alert, late-night, goal). */
  const afterSave = useCallback(
    async (label: string) => {
      setSaved(label);
      setNudge(null);
      recent.reload();
      try {
        const r = await api<{ nudge: { text: string } | null }>("/nudge");
        setNudge(r.nudge?.text ?? null);
      } catch {
        setNudge(null);
      }
    },
    [recent],
  );

  async function remove(id: string) {
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      recent.reload();
    } catch {
      // The row stays in the list; reload will show the true state.
      recent.reload();
    }
  }

  return (
    <>
      <Reveal index={0}>
      <Card className="p-0">
        <div role="tablist" aria-label="How to add" className="flex border-b border-outline-variant px-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                "-mb-px border-b-2 px-4 py-3 font-headline text-sm font-semibold transition-colors",
                tab === item.id ? "border-ink text-on-surface" : "border-transparent text-secondary hover:text-on-surface",
              )}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <div className="space-y-5 p-5">
          {tab === "type" ? <TypeIt onSaved={afterSave} /> : null}
          {tab === "manual" ? <ManualForm onSaved={afterSave} /> : null}
          {tab === "csv" ? <CsvImport onImported={(n) => afterSave(`${n} transactions imported`)} /> : null}

          {saved ? (
            <Pop key={saved}>
              <Notice tone="success">Saved: {saved}.</Notice>
            </Pop>
          ) : null}
          {nudge ? (
            <Pop key={nudge}>
              <Notice>
                <span className="font-medium text-on-surface">Advisor: </span>
                {cleanAiText(nudge)}
              </Notice>
            </Pop>
          ) : null}
        </div>
      </Card>
      </Reveal>

      <Reveal index={1}>
      <Card>
        <h2 className="mb-3 font-headline text-base font-semibold text-on-surface">{t("recent_entries")}</h2>
        {!recent.data ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : recent.data.expenses.length === 0 ? (
          <p className="text-sm text-secondary">Nothing logged this month yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-xs text-secondary">
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Merchant</th>
                  <th className="hidden pb-2 text-left font-medium sm:table-cell">Category</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                <AnimatePresence initial={false}>
                {recent.data.expenses.slice(0, 6).map((e) => (
                  <motion.tr key={e.id} layout initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 28 }} transition={{ duration: 0.25 }}>
                    <td className="py-2.5 text-secondary">{formatDayMonth(e.spent_on)}</td>
                    <td className="py-2.5 font-medium text-on-surface">{e.merchant || "—"}</td>
                    <td className="hidden py-2.5 text-secondary sm:table-cell">{e.category}</td>
                    <td className="tabular py-2.5 text-right font-medium text-on-surface">{inr(e.amount)}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Delete ${e.merchant || e.category} ${inr(e.amount)}`}
                        onClick={() => remove(e.id)}
                        className="rounded p-1 text-secondary hover:bg-surface-container-low hover:text-error"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </Reveal>
      <Disclaimer />
    </>
  );
}

/* ---------- natural language ---------- */

type Parsed = { amount: number | null; category: string; merchant: string; spent_on: string; confidence: number; needs_clarification?: string };

function TypeIt({ onSaved }: { onSaved: (label: string) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { language, t } = useApp();
  const engine = useVoiceEngine();
  // Words appear in the box as you speak (browser engine); the final text is parsed as soon as you stop.
  const voice = useVoiceInput(
    language,
    (spoken) => {
      setText(spoken);
      void parse(spoken);
    },
    (interim) => setText(interim),
  );

  async function parse(input: string = text) {
    setError(null);
    setBusy("parse");
    try {
      const p = await api<Parsed>("/expenses/parse", { json: { text: input, today: todayISO() } });
      setParsed(p);
      setAmountText(p.amount === null ? "" : String(p.amount));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!parsed) return;
    const amount = parseNumber(amountText);
    if (!(amount > 0)) return setError("Enter the amount first.");
    setError(null);
    setBusy("save");
    try {
      await api("/expenses", { json: { amount, category: parsed.category, merchant: parsed.merchant, spent_on: parsed.spent_on, source: "nl" } });
      onSaved(`${parsed.merchant || parsed.category} ${inr(amount)}`);
      setParsed(null);
      setText("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const needsAmount = parsed !== null && parsed.amount === null;

  return (
    <>
      <div>
        <Field label={t("describe_expense")} hint="Works in English, Hindi and Hinglish. You can also speak it.">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && text.trim() && busy === null && parse()}
              placeholder="kal Zomato pe 450 diye"
              maxLength={300}
            />
            {voice.supported ? (
              <button
                type="button"
                onClick={voice.status === "recording" ? voice.stop : voice.start}
                disabled={voice.status === "transcribing" || busy !== null}
                aria-label={voice.status === "recording" ? "Stop recording" : t("speak")}
                title={voice.status === "recording" ? "Stop recording" : t("speak")}
                className={cx("btn shrink-0 !px-0", voice.status === "recording" ? "w-11 border-error bg-error text-white animate-pulse" : "btn-outline w-11")}
              >
                {voice.status === "transcribing" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : voice.status === "recording" ? <Square className="h-4 w-4 fill-current" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
              </button>
            ) : null}
            <Button onClick={() => parse()} disabled={!text.trim() || busy !== null || voice.status !== "idle"}>
              {busy === "parse" ? "Parsing…" : t("parse")}
            </Button>
          </div>
        </Field>
        <p className="mt-2 min-h-5 text-xs text-secondary" aria-live="polite">
          {voice.status === "recording"
            ? `Listening… ${voice.seconds}s. Tap the square when you are done.`
            : voice.status === "transcribing"
              ? voice.percent !== null
                ? `Getting the voice model ready (first time only): ${voice.percent}%`
                : "Turning your voice into text on this device…"
              : voice.supported
                ? `Tap the mic and speak. Using ${engine === "browser" ? "your browser's speech recognition" : "Whisper on this device"} (change in Settings).`
                : ""}
        </p>
        {voice.error ? (
          <div className="mt-2">
            <Notice tone="error">{voice.error}</Notice>
          </div>
        ) : null}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {parsed ? (
        <Pop className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <h3 className="mb-3 font-headline text-sm font-semibold text-on-surface">Review before saving</h3>
          {needsAmount ? (
            <div className="mb-3">
              <Notice>{parsed.needs_clarification ?? "How much was it?"}</Notice>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Amount (₹)">
              <input
                className={cx(inputCls, "tabular")}
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder={needsAmount ? "Enter amount" : undefined}
                autoFocus={needsAmount}
              />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={parsed.category} onChange={(e) => setParsed({ ...parsed, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Merchant">
              <input className={inputCls} value={parsed.merchant} onChange={(e) => setParsed({ ...parsed, merchant: e.target.value })} />
            </Field>
            <Field label="Date">
              <input className={inputCls} type="date" max={todayISO()} value={parsed.spent_on} onChange={(e) => setParsed({ ...parsed, spent_on: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : t("save_expense")}
            </Button>
            <Button variant="text" onClick={() => setParsed(null)} disabled={busy !== null}>
              Discard
            </Button>
          </div>
        </Pop>
      ) : null}
    </>
  );
}

/* ---------- manual ---------- */

function ManualForm({ onSaved }: { onSaved: (label: string) => void }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = parseNumber(amount);
    if (!(value > 0)) return setError("Enter the amount.");
    setError(null);
    setBusy(true);
    try {
      await api("/expenses", { json: { amount: value, category, merchant, spent_on: date, note: note || undefined, source: "manual" } });
      onSaved(`${merchant || category} ${inr(value)}`);
      setAmount("");
      setMerchant("");
      setNote("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)">
          <input className={cx(inputCls, "tabular")} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Category">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Merchant">
          <input className={inputCls} value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Date">
          <input className={inputCls} type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note (optional)">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save expense"}
      </Button>
    </>
  );
}

/* ---------- CSV ---------- */

type CsvRow = { date: string; description: string; amount: number; category: string; confidence: number; needsReview: boolean };

function CsvImport({ onImported }: { onImported: (count: number) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState<"read" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy("read");
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await api<{ rows: CsvRow[]; skipped: number }>("/expenses/import", { body });
      setRows(r.rows);
      setSkipped(r.skipped);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function commit() {
    if (!rows) return;
    setError(null);
    setBusy("import");
    try {
      const r = await api<{ imported: number }>("/expenses/import", {
        json: { rows: rows.map(({ date, description, amount, category }) => ({ date, description, amount, category })) },
      });
      setRows(null);
      onImported(r.imported);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const review = rows?.filter((r) => r.needsReview).length ?? 0;

  return (
    <>
      <div>
        <p className="mb-2 text-sm text-secondary">Upload a bank statement CSV with date, description and amount columns (up to 500 rows). You review the categories before anything is saved.</p>
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button variant="outline" onClick={() => input.current?.click()} disabled={busy !== null}>
          <Upload className="h-4 w-4" aria-hidden />
          {busy === "read" ? "Reading…" : "Choose CSV file"}
        </Button>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {rows ? (
        <div>
          <div className="mb-3 space-y-2">
            <Notice>
              {rows.length} rows ready. {review > 0 ? `${review} need a look (highlighted).` : "Everything was categorized with confidence."}
              {skipped > 0 ? ` ${skipped} rows could not be read and were left out.` : ""}
            </Notice>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-container-low text-xs text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {rows.map((r, i) => (
                  <tr key={i} className={r.needsReview ? "bg-warning-container" : undefined}>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">{formatDayMonth(r.date)}</td>
                    <td className="px-3 py-2 text-on-surface">{r.description}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Category for ${r.description}`}
                        className="h-8 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-xs text-on-surface"
                        value={r.category}
                        onChange={(e) => setRows((all) => all && all.map((x, j) => (j === i ? { ...x, category: e.target.value, needsReview: false } : x)))}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="tabular px-3 py-2 text-right font-medium text-on-surface">{inr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={commit} disabled={busy !== null}>
              {busy === "import" ? "Importing…" : `Import ${rows.length} rows`}
            </Button>
            <Button variant="text" onClick={() => setRows(null)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
