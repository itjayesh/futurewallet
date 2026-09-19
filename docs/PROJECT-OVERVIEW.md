# FutureWallet: Project Overview (in depth)

Prodapt Hackathon, Group 13. AI Budget & Expense Advisor for India.
*Other apps show you numbers. FutureWallet shows you your future.*

Code: `C:\Users\Jayesh\budget-advisor` (local only, no git, nothing pushed or deployed).
PRD: `C:\Users\Jayesh\Documents\FutureWallet-PRD.md`.

---

## 0. Project overview (shared context)

**What it is.** A web app where a user logs expenses (typed, spoken in Hinglish, or imported from CSV), gets a budget, sets goals, and talks to an AI advisor. The signature feature is **Future You**: it projects the user's money 1 to 10 years ahead in two lines (today's habits vs. a better saving rate) and has "future you" write a message back.

**Who it is for.** Young Indian earners (INR, Indian digit grouping, IST dates, Hindi/Hinglish/English).

**The one rule that shapes everything: code calculates every number, the model only writes.**
- All maths lives in pure, tested functions (`src/lib/finance`).
- The AI categorises, explains and phrases. Its output is checked against the computed facts (grounding check) before the user sees it.
- The advisor can only *propose* budget/goal changes and deletes. They run only after the user taps Confirm (`/api/agent/confirm`). Adding an expense is immediate, with Undo.

**Main screens.**

| Screen | Route |
|---|---|
| Landing (live demos) | `/` |
| Sign in / sign up | `/login` |
| Onboarding + demo data | `/onboarding` |
| Dashboard | `/dashboard` |
| Add expense (type / voice / form / CSV) | `/add` |
| Budget | `/budget` |
| Goals | `/goals` |
| Future You | `/future` |
| Advisor chat (+ floating dock everywhere) | `/advisor` |
| Money personality + share card | `/personality` |
| Settings (language, delete, voice, theme) | `/settings` |
| Wrapped (swipeable popup, opened from header) | popup |
| AI dev console (not product UI) | `/agent-lab` |

**Signature features.** Future You with levers (horizon, return, lump sum, yearly raise, today's rupees, milestones), Wrapped (Tinder-style swipe cards + shareable PNG), Roast My Wallet, Money Personality, What-If, Spending Triggers, proactive nudges, health score.

**How the 5 parts fit together.**

```
 [1 Product & Design] --> [2 Frontend] --calls--> [3 Backend & Finance Logic]
                                                        |            |
                                                        v            v
                                              [4 Data & Auth]   [5 AI, Voice & Quality]
```

---

## Part 1: Product and Design

**Goal.** Decide what to build and make it feel like a Gen-Z product without looking like a template.

**Technical detail**
- PRD defines features F1 to F10, personas, and the API contract.
- Design system **"FutureWallet Pop"** (Stitch project `8453799014561505763`): paper `#F7F3EA`, ink `#15130F`, lime `#C8F03C`, pink `#FF3D8B`, blue `#3A5BFF`. Bricolage Grotesque (headlines) + DM Sans (body). Hard offset shadows on `.pop-card`, `.btn`, `.sticker`.
- Tokens are CSS variables in `src/app/globals.css`. Dark mode is a class on `<html>`. `--text-scale` drives text size (base 17px, 18.5px on wide screens).
- Stitch exports carried stale colours and invented stats, so tokens were defined by hand and only the layout was borrowed.
- Chart palette was checked with the dataviz validator (`validate_palette.js`) for colour-blind separation: categorical blue / aqua / yellow / magenta / violet + neutral. Now/future pair: `#3A5BFF` / `#FF3D8B` (light), `#5B7BFF` / `#F2508F` (dark). The first muted palette failed and was replaced.
- Copy rules: no filler chips or fake stats; "General guidance, not regulated financial advice."

**Tools:** Stitch MCP (screens + design system), Google Fonts (via `next/font`), dataviz palette validator, headless Chrome + Chrome DevTools Protocol for screenshots (light, dark, mobile).

---

## Part 2: Frontend

**Goal.** Fast, animated, mobile-friendly UI in 3 languages.

**Technical detail**
- **Next.js 16.3.5 App Router (Turbopack), React 19.2.8, TypeScript.** Route groups: public pages (`/`, `/login`, `/onboarding`) and `(app)/` pages behind `AppShell`. Note: this Next version has breaking changes (see `AGENTS.md`), e.g. route params are async.
- **AppShell** provides context: persona, language, `t()` translator, `openWrapped()`. Header has Wrapped button and settings gear. `ChatDock` floats the advisor on every screen.
- **Data fetching:** `useApi` hook in `src/lib/client/api.ts` (promise-callback fetch, React-19-lint safe).
- **Animation** (`src/components/motion.tsx`): `CountUp`, `Reveal`, `InView`, `Pop`, `Typewriter`, `PageTransition`. Recharts' own animation is disabled (it stuck in capture); motion reveals are used instead.
- **Charts** (`charts.tsx`): health ring, donut, trend, weekday bars, Future You two-line chart with milestone markers.
- **Wrapped** (`WrappedModal.tsx`): popup card deck, swipe by drag, PNG share via canvas (`shareCard.ts`).
- **i18n** (`src/lib/client/i18n.ts`): `[en, hinglish, hi]` tuples, `t(key, vars)`. Navigation, headings, main buttons translated; helper text still English.
- **AI text display** (`aiText.ts`, `RichText.tsx`): strips markdown, groups rupees the Indian way (₹11833 to ₹11,833), splits walls of text at sentence ends, renders bold and lists with no `innerHTML`. Regexes avoid lookbehind and the `s` flag for older Safari.
- **Voice input UI** (`src/lib/client/voice/*`): see Part 5.
- **Settings:** language, advisor style, profile, theme, text size, voice engine/model, delete data (by scope), delete account (type `DELETE`).
- **Hydration warning** the team may see (`bis_skin_checked`) comes from a browser extension, not the app; `suppressHydrationWarning` is set on body.

**Tools:** Next.js, React, TypeScript, Tailwind CSS 4 (`@tailwindcss/postcss`), Recharts 3, `motion` 13 (motion/react), lucide-react (icons), `next/font/google`, ESLint 9 + `eslint-config-next` (React 19 rules).

---

## Part 3: Backend, API and Finance Logic

**Goal.** A stable API and trustworthy numbers.

**Technical detail**
- **Route handlers** in `src/app/api/**` (Next.js). Helpers in `src/lib/http.ts` (`requireUser`, `route`, `readJson`) and `src/lib/errors.ts` give uniform auth, validation and error responses. Validation with **zod 4**.
- **Endpoints:** `profile`, `expenses` (+ `parse`, `[id]`, `import`), `summary`, `budget/generate`, `budgets`, `goals` (+ `[id]`, `[id]/contribute`, `[id]/plan`), `future` (GET/POST: `annualReturnPct`, `lumpSum`, `stepUpPct`, `real`), `whatif`, `insights/refresh`, `chat`, `agent/chat` (SSE stream), `agent/confirm`, `agent/status`, `demo/seed`, `nudge`, `nudges`, `triggers`, `personality`, `wrapped`, `data` (`DELETE ?scope=`), `account` (`DELETE`), `auth/callback`.
- **Finance library** (`src/lib/finance`, pure and unit-tested):
  - `projection`: `balance[m] = balance[m-1] * (1 + r/12) + saving(m)`, default return 7%.
  - `scenario`: lump sum, yearly step-up, inflation 6% ("today's rupees"), milestones.
  - `healthScore`: 40 savings rate + 30 budget + 20 goals + 10 impulse.
  - `budget`: normaliser keeps limits at or under income and leaves a savings remainder.
  - `goalPlan`: monthly needed, "cut X by ₹Y" tip (cut at most 40% of a category, rounded up to ₹100).
  - `whatIf`: months to reach a target.
- **Services** (`src/lib/services`): `context` (loads user data, builds summary and the AI fact sheet), `future`, `patterns` (spending triggers, money personality), `nudge`/`nudges`, `wrapped`, `seed` (deterministic demo data: 6 months, income ₹45,000, late-night pattern), `tools` (executors the agent calls; `applyPendingAction`), `language` (adds language instructions to prompts without touching the AI layer).
- **CSV import** (`csv.ts`): rows whose column count differs from the header are skipped (fixes a real bug where unquoted "1,234" became ₹1).
- **Repo abstraction** (`src/lib/db/types.ts`): one `Repo` interface, two implementations (see Part 4).

**Tools:** Next.js Route Handlers, TypeScript, zod, Vitest (unit tests for finance, services, csv).

---

## Part 4: Data and Auth

**Goal.** Store each user's data safely; nobody can read anyone else's.

**Technical detail**
- **Supabase** project ref `vsqzgasakxhvwijquesh`. Postgres + Auth. Secrets live only in `.env.local`.
- **Tables:** `profiles`, `expenses`, `budgets`, `goals`, `insights`, `chat_messages`, `pending_actions`. **Row-level security on every table.**
- **Migrations** (`supabase/migrations`):
  - `0001_init.sql`: the tables, RLS policies, `handle_new_user` trigger (creates the profile on sign-up).
  - `0002_settings.sql`: `profiles.language`, and `delete_my_account()` (security-definer function used by account delete).
- **Migration runner** `scripts/db-migrate.mjs` uses `pg` through the IPv4 session pooler (Tokyo, `aws-0-ap-northeast-1`). The direct `db.*` host is IPv6-only and does not resolve on this network.
- **Auth:** email + password via `@supabase/ssr` (cookie sessions) and `@supabase/supabase-js`; `/api/auth/callback` handles the email link.
- **Two repos behind one interface:** `supabase.ts` (real) and `memory.ts` (in-memory on `globalThis`). Setting `FW_DEV_STORE=1` forces the in-memory store with a fixed dev user. With empty Supabase keys the app also runs in this mode.
- **Data rules:** 12 fixed categories, INR, IST date strings.
- **Verification:** `scripts/e2e-supabase.mjs` runs **39 checks against the real database** (creates a temporary confirmed user through SQL, uses cookies like a browser, tests RLS, delete-data and delete-account, then removes the user).

**Open items for the team**
1. Supabase "Confirm email" is still ON, so sign-ups need an emailed link. Turn it off before a demo (Authentication > Providers > Email).
2. The DB password was pasted in chat once. **Rotate it.**
3. Our schema adds `pending_actions`; the team's canonical `feature/db` schema does not. Reconcile before merging.

**Tools:** Supabase (Postgres, Auth, RLS), `@supabase/ssr`, `@supabase/supabase-js`, `pg`, SQL migrations.

---

## Part 5: AI, Voice and Quality

**Goal.** Useful, safe, grounded AI, good input methods, and proof that it all works.

**5a. AI layer** (`src/lib/ai`, owned by the AI workstream; edit only additively)
- **OpenAI SDK 7** with `zodResponseFormat` and `chat.completions.parse` for structured output. Model IDs per role come from env (`OPENAI_MODEL_FAST`, `OPENAI_MODEL_MID`); the key stays server-side.
- **Agent** (`agent.ts`): tool-calling loop with 14 tools (for example `get_spending_summary`, `delete_expense`). Reads run immediately; budget/goal writes and deletes are proposals that need Confirm.
- **Guardrails** (`guardrails.ts`): prompt-injection and crisis gates, redaction, output policy.
- **Grounding** (`grounding.ts`): numbers in the reply must match the computed fact sheet.
- **Personas** (`personas.ts`), expense parser, `AI_MOCK=1` canned mode so the app works without a key.
- **Model allowance:** about 250k tokens/day across the big models (gpt-5.x, gpt-4.1, gpt-4o, o1, o3) and 2.5M/day across mini/nano models. Default to the mini models.

**5b. Voice input** (Add expense)
- Engine 1, **Browser** (default): the browser's SpeechRecognition; best for Hindi and Indian accents; needs internet in Chrome/Edge.
- Engine 2, **On this device**: Whisper (tiny / base / small, q8, wasm) via `@huggingface/transformers` in a Web Worker. Private, offline after first download.
- Pipeline: mic with auto-gain on and noise suppression off, peak normalisation, silence trim, then Devanagari-to-Roman normalisation (`normalize.ts`) so the parser can read it.
- Caveat: real Hindi/Hinglish accuracy is **not measured**; only a synthetic English voice was tested end to end.

**5c. Testing and quality**
- **Vitest 5:** 156 tests pass, 13 skipped (they need an OpenAI key, including the parser eval with an 18-of-20 target).
- `tsc`, ESLint 9, `next build` (39 routes/pages) all clean.
- **e2e:** 39/39 on real Supabase.
- Browser checks with headless Chrome + CDP, including real mouse-drag swipes for Wrapped and a fake-mic WAV (made with Windows SAPI) for voice.

**5d. Run it**
```
npm install
copy .env.example .env.local     # fill in
npm run db:migrate
npm run dev                      # http://localhost:3000
npm test | npm run lint | npm run build | npm run e2e:supabase
```
To use real AI: set `OPENAI_API_KEY` in `.env.local` yourself (never in chat) and remove `AI_MOCK`.

**Tools:** OpenAI API + SDK, zod, `@huggingface/transformers` (Whisper), Web Speech API, Web Workers, Vitest, ESLint, TypeScript, headless Chrome + DevTools Protocol, Windows SAPI (test audio).

---

## Full tool list (quick reference)

| Area | Tools |
|---|---|
| Framework | Next.js 16.3.5, React 19.2.8, TypeScript 5, Node 22 types |
| Styling / UI | Tailwind CSS 4, Stitch MCP, `next/font` (Bricolage Grotesque, DM Sans), lucide-react |
| Charts / motion | Recharts 3.10, motion 13, dataviz palette validator |
| Backend | Next.js Route Handlers, zod 4 |
| Data / auth | Supabase (Postgres, Auth, RLS), `@supabase/ssr`, `@supabase/supabase-js`, `pg` |
| AI | OpenAI SDK 7 (`zodResponseFormat`, tool calling), mock mode |
| Voice | `@huggingface/transformers` 4.3 (Whisper), Web Speech API |
| Quality | Vitest 5, ESLint 9, tsc, e2e script, headless Chrome + CDP |

## Constraints and status

- Everything is local. **No GitHub commits, pushes or `git init`** in this project, and do not touch the `prodapt-hackathon` repo from here.
- Not deployed. Deploy (for example Vercel) is a separate step, only when asked.
- Known gaps: helper text not fully translated, voice accuracy on real Hindi unmeasured, real-OpenAI behaviour only lightly tested, schema reconciliation with `feature/db` pending.
