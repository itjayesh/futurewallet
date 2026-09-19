# FutureWallet

AI budget and expense advisor for India. Prodapt Hackathon, Group 13.
*Other apps show you numbers. FutureWallet shows you your future.*

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Recharts · Supabase (Postgres, Auth, RLS) · OpenAI (server-side only).

## Run it

```bash
npm install
cp .env.example .env.local        # fill it in (see below)
npm run db:migrate                # applies supabase/migrations to your Supabase project
npm run dev                       # http://localhost:3000
```

Useful scripts: `npm test` (unit tests), `npm run lint`, `npm run build`, `npm run e2e:supabase` (end-to-end check against the real database, needs `npm run dev` on port 3111).

### Environment

| Variable | What it does |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Turns on real auth and storage. Empty = in-memory dev store, no login. |
| `SUPABASE_DB_HOST`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` | Only for `db:migrate`. Use the **session pooler** host (the direct `db.*` host is IPv6-only). |
| `OPENAI_API_KEY`, `OPENAI_MODEL_FAST`, `OPENAI_MODEL_MID` | The AI layer. Model IDs live only here. |
| `AI_MOCK=1` | Canned AI answers, so everything works without a key. **Remove it once `OPENAI_API_KEY` is set.** |
| `FW_DEV_STORE=1` | Force the in-memory store even if Supabase keys exist (local testing). |

**Supabase setting to change before a demo:** Authentication > Providers > Email > turn **off** "Confirm email". With it on, new sign-ups must click a link in their inbox before they can sign in.

## What is in it

| Screen | Route | PRD |
|---|---|---|
| Landing with live demos (slider, advisor voices) | `/` | |
| Sign in / create account | `/login` | Auth |
| Onboarding + "Load demo data" | `/onboarding` | Onboarding, F10 |
| Dashboard: health ring, spent vs budget, category donut, 6-month trend, top merchants, advisor insight, spending triggers | `/dashboard` | F2 |
| Add expense: type it (Hinglish), manual form, CSV import with review | `/add` | F1, F8 |
| Budget: generate, edit with live totals, 80% / 100% states | `/budget` | F3 |
| Goals: progress, monthly needed, "cut X by ₹Y" tip, contributions | `/goals` | F4 |
| Future You: slider, two projections, future-self message, what-if. Tunable horizon (1 to 10 years), assumed return, lump sum, yearly raise, "in today's rupees", "the life you unlock" milestones, and a split of what you put in vs growth | `/future` | F5, F9 |
| Advisor chat (full page, and a floating panel on every other screen), personas, "Roast my wallet" | `/advisor` | F6, F7 |
| Money personality + shareable PNG card | `/personality` | NICE |
| Wrapped: this month as a swipeable card deck (a popup, opened from the header, dashboard or personality page) with a shareable PNG | popup | |
| Settings: language (English, Hinglish, हिन्दी), advisor style, profile, theme and text size, voice input, delete data / account | `/settings` | |

## Voice input

The mic on **Add expense** has two engines (Settings > Voice input):

- **Browser** (default): the browser's own speech recognition. Most accurate for Hindi, Hinglish and Indian accents, and shows words as you speak. In Chrome and Edge the audio is processed by the vendor's speech service, so it needs internet.
- **On this device**: Whisper via `@huggingface/transformers` in a web worker. Private and offline after the first download (tiny about 40 MB, base about 80 MB, small about 250 MB). Recordings are trimmed of silence and normalised first. Hindi and Hinglish speech is translated to English text so the parser can read it.

Devanagari output is mapped to Roman Hinglish for common words before parsing. Use the **small** model for Hindi on device; tiny and base mishear it.

## How it is built

- **Code calculates, the model writes.** Every number comes from pure functions in `src/lib/finance` (projection, health score, goal plan, budget normaliser, what-if). The AI layer (`src/lib/ai`) only categorises, explains and phrases, and its output is checked against the computed facts.
- `src/lib/services` builds the summary and the AI fact sheet from the database, detects nudges, spending triggers and the money personality, and seeds the demo data.
- `src/lib/db` has two implementations of one `Repo` interface: Supabase (row-level security on every table) and an in-memory dev store.
- `src/app/api/**` is the contract from the PRD, plus `/agent/chat` (streamed events) and `/agent/confirm` (budget and goal changes the advisor proposes only run after the user confirms).
- Design: "FutureWallet Pop", generated in Stitch (project `FutureWallet`) and ported to tokens in `src/app/globals.css`. Chart colours were validated for colour-blind separation in light and dark.

## Not done / decide

- **Deploy:** nothing is deployed and nothing is pushed anywhere. First Vercel deploy is a separate step.
- **OpenAI:** set `OPENAI_API_KEY` and remove `AI_MOCK` to use real models. The parser accuracy target (18 of 20 phrases) has an eval in `src/lib/ai` that runs only with a key.
- **Voice accuracy** on real Hindi or Hinglish speech has not been measured here. It was tested end to end with a synthetic English voice only.
- **Interface language:** navigation, headings and the main buttons are translated. Longer helper text stays in English. The advisor's replies follow the language setting.

General guidance, not regulated financial advice.
