"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp, type Persona } from "@/components/AppShell";
import { Reveal } from "@/components/motion";
import { Button, Card, cx, Disclaimer, ErrorState, Field, inputCls, Notice, Segmented, Skeleton } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/client/api";
import { LANGUAGE_LABELS } from "@/lib/client/i18n";
import { authEnabled, supabaseBrowser } from "@/lib/client/supabase";
import { setTextScale, setThemePref, useTextScale, useThemePref, type TextScale, type ThemePref } from "@/lib/client/theme";
import { clearVoiceModelCache, setVoiceEngine, setVoiceModel, useVoiceEngine, useVoiceModel, type VoiceEngine, type VoiceModel } from "@/lib/client/voice/prefs";
import { LANGUAGES, type FixedCostRow, type Profile } from "@/lib/db/types";
import { parseNumber } from "@/lib/format";

const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: "friendly", label: "Friendly", blurb: "Warm and encouraging" },
  { id: "roast", label: "Roast", blurb: "Playful teasing, then a real fix" },
  { id: "coach", label: "Coach", blurb: "Direct, no jokes" },
];

export default function SettingsPage() {
  const { t, language, setLanguage, persona, setPersona } = useApp();
  const profile = useApi<{ profile: Profile | null }>("/profile");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Reveal index={0}>
        <Section title={t("s_language")} hint={t("s_language_hint")}>
          <RadioCards
            label={t("s_language")}
            value={language}
            onChange={(v) => void setLanguage(v)}
            options={LANGUAGES.map((l) => ({ id: l, title: LANGUAGE_LABELS[l].native, note: LANGUAGE_LABELS[l].hint }))}
          />
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title={t("s_advisor")}>
          <RadioCards
            label={t("s_advisor")}
            value={persona}
            onChange={(v) => void setPersona(v)}
            options={PERSONAS.map((p) => ({ id: p.id, title: p.label, note: p.blurb }))}
          />
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title={t("s_profile")}>
          {profile.error && !profile.data ? (
            <ErrorState message={profile.error.message} onRetry={profile.reload} />
          ) : !profile.data?.profile ? (
            <Skeleton className="h-40" />
          ) : (
            <ProfileForm profile={profile.data.profile} onSaved={profile.reload} />
          )}
        </Section>
      </Reveal>

      <Reveal index={3}>
        <AppearanceSection />
      </Reveal>

      <Reveal index={4}>
        <VoiceSection />
      </Reveal>

      <Reveal index={5}>
        <DataSection />
      </Reveal>

      <Reveal index={6}>
        <AccountSection />
      </Reveal>
      <Disclaimer />
    </div>
  );
}

/* ---------- building blocks ---------- */

function Section({ title, hint, children, danger }: { title: string; hint?: string; children: ReactNode; danger?: boolean }) {
  return (
    <Card hero={danger} className={cx("space-y-4", danger && "!border-error")}>
      <div>
        <h2 className={cx("font-headline text-xl font-bold tracking-tight", danger ? "text-error" : "text-on-surface")}>{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-secondary">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function RadioCards<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; title: string; note: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={cx(
              "rounded-xl border-2 p-4 text-left transition-all",
              selected ? "pop-card bg-primary text-on-primary" : "border-ink/20 bg-surface-container-lowest hover:border-ink",
            )}
          >
            <span className="block font-headline text-lg font-extrabold">{o.title}</span>
            <span className={cx("mt-0.5 block text-sm", selected ? "text-on-primary/80" : "text-secondary")}>{o.note}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- profile ---------- */

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState(profile.name);
  const [income, setIncome] = useState(String(profile.monthly_income));
  const [fixed, setFixed] = useState<{ name: string; amount: string }[]>(profile.fixed_costs.map((f: FixedCostRow) => ({ name: f.name, amount: String(f.amount) })));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const setRow = (i: number, patch: Partial<{ name: string; amount: string }>) => setFixed((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    const incomeValue = parseNumber(income);
    if (!name.trim()) return setMessage({ tone: "error", text: "Enter your name." });
    if (!(incomeValue > 0)) return setMessage({ tone: "error", text: "Enter your monthly income." });
    const fixedCosts = fixed.filter((r) => r.name.trim() || r.amount.trim()).map((r) => ({ name: r.name.trim(), amount: parseNumber(r.amount) }));
    if (fixedCosts.some((f) => !f.name || Number.isNaN(f.amount))) return setMessage({ tone: "error", text: "Give every fixed cost a name and an amount." });
    setBusy(true);
    setMessage(null);
    try {
      await api("/profile", { method: "PUT", json: { name: name.trim(), income: incomeValue, fixedCosts } });
      setMessage({ tone: "success", text: t("s_saved") });
      onSaved();
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("s_name")}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label={t("s_income")}>
          <input className={cx(inputCls, "tabular")} inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-on-surface">{t("s_fixed")}</legend>
        <div className="space-y-2">
          {fixed.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label="Cost name" className={inputCls} value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} />
              <input aria-label="Cost amount in rupees" className={cx(inputCls, "tabular !w-32 shrink-0")} inputMode="numeric" value={row.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              <button
                type="button"
                aria-label={`Remove ${row.name || "cost"}`}
                onClick={() => setFixed((rows) => rows.filter((_, j) => j !== i))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <Button variant="text" className="mt-2" onClick={() => setFixed((rows) => [...rows, { name: "", amount: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("s_add_fixed")}
        </Button>
      </fieldset>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : t("s_save")}
      </Button>
    </div>
  );
}

/* ---------- appearance and voice ---------- */

function AppearanceSection() {
  const { t } = useApp();
  const theme = useThemePref();
  const scale = useTextScale();
  const themes: { id: ThemePref; label: string }[] = [
    { id: "system", label: t("s_theme_system") },
    { id: "light", label: t("s_theme_light") },
    { id: "dark", label: t("s_theme_dark") },
  ];
  const sizes: { id: TextScale; label: string }[] = [
    { id: "1", label: t("s_size_normal") },
    { id: "1.12", label: t("s_size_large") },
    { id: "1.25", label: t("s_size_xl") },
  ];
  return (
    <Section title={t("s_appearance")}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-on-surface">{t("s_theme")}</p>
          <Segmented label={t("s_theme")} value={theme} onChange={setThemePref} options={themes} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-on-surface">{t("s_text_size")}</p>
          <Segmented label={t("s_text_size")} value={scale} onChange={setTextScale} options={sizes} />
        </div>
      </div>
    </Section>
  );
}

function VoiceSection() {
  const { t } = useApp();
  const engine = useVoiceEngine();
  const model = useVoiceModel();
  const [message, setMessage] = useState<string | null>(null);
  const engines: { id: VoiceEngine; label: string }[] = [
    { id: "browser", label: "Browser (most accurate)" },
    { id: "device", label: "On this device (private)" },
  ];
  const models: { id: VoiceModel; label: string }[] = [
    { id: "small", label: t("s_voice_best") },
    { id: "base", label: t("s_voice_better") },
    { id: "tiny", label: t("s_voice_fast") },
  ];
  return (
    <Section title={t("s_voice")} hint={t("s_voice_hint")}>
      <div>
        <p className="mb-2 text-sm font-medium text-on-surface">{t("s_voice_engine")}</p>
        <Segmented label={t("s_voice_engine")} value={engine} onChange={setVoiceEngine} options={engines} />
        <p className="mt-2 text-xs text-secondary">
          {engine === "browser"
            ? "Uses your browser's speech recognition. Best for Hindi, Hinglish and Indian accents, and it shows words as you speak. In Chrome and Edge your audio is processed by the browser's speech service, so it needs internet. If the browser has none, on-device voice is used."
            : "Runs Whisper on this device. Your audio is never uploaded and it works offline after the first download, but smaller models mishear more, especially Hindi and Hinglish."}
        </p>
      </div>

      {engine === "device" ? (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-on-surface">{t("s_voice_model")}</p>
            <Segmented label={t("s_voice_model")} value={model} onChange={setVoiceModel} options={models} />
            <p className="mt-2 text-xs text-secondary">The model downloads the first time you use the microphone. Use Best for Hindi and Hinglish. Hindi and Hinglish speech is turned into English text so it can be understood.</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await clearVoiceModelCache();
              setMessage(t("s_voice_cleared"));
            }}
          >
            {t("s_voice_clear")}
          </Button>
        </>
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
    </Section>
  );
}

/* ---------- data and account ---------- */

type RowState = "idle" | "confirm" | "working" | "done" | "error";

/** One action that needs a second click (and, for the account, a typed word) before it runs. */
function DangerRow({
  title,
  description,
  requireWord,
  onConfirm,
}: {
  title: string;
  description: string;
  requireWord?: string;
  onConfirm: () => Promise<string | void>;
}) {
  const { t } = useApp();
  const [state, setState] = useState<RowState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  async function run() {
    setState("working");
    try {
      setMessage((await onConfirm()) ?? "Done.");
      setState("done");
    } catch (e) {
      setMessage(errorMessage(e));
      setState("error");
    }
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-on-surface">{title}</p>
          <p className="text-sm text-secondary">{description}</p>
        </div>
        {state === "idle" || state === "done" || state === "error" ? (
          <Button variant="outline" onClick={() => { setState("confirm"); setMessage(null); setTyped(""); }}>
            {title}
          </Button>
        ) : null}
      </div>

      {state === "confirm" || state === "working" ? (
        <div className="mt-3 rounded-lg border-2 border-error bg-error-container p-3">
          <p className="text-sm font-medium text-error">This cannot be undone.</p>
          {requireWord ? (
            <label className="mt-2 block text-sm text-on-surface">
              Type <strong>{requireWord}</strong> to confirm
              <input className={cx(inputCls, "mt-1")} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={state === "working" || (!!requireWord && typed !== requireWord)}
              className="btn border-error bg-error text-white shadow-[3px_3px_0_var(--pop-shadow)]"
            >
              {state === "working" ? "Working…" : t("confirm_yes")}
            </button>
            <Button variant="outline" onClick={() => setState("idle")} disabled={state === "working"}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {message && (state === "done" || state === "error") ? (
        <div className="mt-3">
          <Notice tone={state === "done" ? "success" : "error"}>{message}</Notice>
        </div>
      ) : null}
    </li>
  );
}

function DataSection() {
  const { t } = useApp();
  const router = useRouter();

  const wipe = (scope: string, done: string) => async () => {
    await api(`/data?scope=${scope}`, { method: "DELETE" });
    router.refresh();
    return done;
  };

  return (
    <Section title={t("s_data")} danger>
      <ul className="divide-y divide-outline-variant">
        <DangerRow
          title={t("d_demo")}
          description="Replaces your data with 6 months of sample transactions, a budget and two goals, and switches the profile to the demo user."
          onConfirm={async () => {
            await api("/demo/seed", { method: "POST" });
            return "Demo data loaded. Open the dashboard to see it.";
          }}
        />
        <DangerRow title={t("d_expenses")} description="Every logged expense, including imported ones." onConfirm={wipe("expenses", "All expenses deleted.")} />
        <DangerRow title={t("d_budget")} description="You can generate a new one from the Budget screen." onConfirm={wipe("budgets", "Budget deleted.")} />
        <DangerRow title={t("d_goals")} description="All savings goals and their progress." onConfirm={wipe("goals", "All goals deleted.")} />
        <DangerRow title={t("d_chat")} description="The saved conversation with the advisor." onConfirm={wipe("chat", "Chat history cleared.")} />
        <DangerRow title={t("d_all")} description="Expenses, budgets, goals, insights and chat. Your profile and sign-in stay." onConfirm={wipe("all", "All your data was deleted.")} />
        <DangerRow
          title={t("d_account")}
          description="Deletes your account and everything in it, permanently."
          requireWord="DELETE"
          onConfirm={async () => {
            await api("/account", { method: "DELETE", json: { confirm: "DELETE" } });
            if (authEnabled) await supabaseBrowser().auth.signOut();
            router.replace("/");
            return "Account deleted.";
          }}
        />
      </ul>
    </Section>
  );
}

function AccountSection() {
  const { t } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (!authEnabled) return null;
  return (
    <Section title={t("s_account")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface">{email ?? "Signed in"}</p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.replace("/login");
          }}
        >
          {t("sign_out")}
        </Button>
      </div>
    </Section>
  );
}
