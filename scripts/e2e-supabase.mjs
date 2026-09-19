// End-to-end check against the real Supabase project. Needs `npm run dev` on port 3111 and .env.local filled in.
// Creates a temporary confirmed user with SQL (email confirmation is on), runs the API flow, then deletes the user and all its rows.
import pg from "pg";
import { createServerClient } from "@supabase/ssr";
import { randomUUID, randomBytes } from "node:crypto";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const db = new pg.Client({ host: process.env.SUPABASE_DB_HOST, port: 5432, user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
const id = randomUUID(), email = `fw-e2e-${id.slice(0, 8)}@example.com`, pw = randomBytes(12).toString("hex");
const results = []; const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

await db.connect();
try {
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3, extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`, [id, email, pw]);
  await db.query(`insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values (gen_random_uuid(),$1::text::uuid,$1::text,jsonb_build_object('sub',$1::text,'email',$2::text),'email',now(),now(),now())`, [id, email]);

  // Sign in through the same library the app uses, and capture the cookies it would set.
  let cookies = [];
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [], setAll: (l) => { cookies = l; } } });
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  check("sign in with password", !error, error?.message);
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; } return { status: r.status, json };
  };

  check("no cookie -> 401", (await fetch(BASE + "/api/profile")).status === 401);
  let r = await call("GET", "/api/profile"); check("profile before onboarding", r.status === 200 && r.json.onboarded === false && r.json.profile?.id === id, `profile row created by trigger: ${!!r.json.profile}`);
  r = await call("GET", "/api/summary"); check("summary before onboarding -> 409", r.status === 409);
  r = await call("POST", "/api/demo/seed"); check("demo seed (319 rows into Postgres)", r.status === 200 && r.json.ok, JSON.stringify(r.json));
  r = await call("GET", "/api/summary"); check("summary from real DB", r.status === 200 && r.json.total > 20000 && r.json.trend.length === 6, `total ${r.json.total}, health ${r.json.healthScore}, late-night ${r.json.lateNight?.share}%`);
  r = await call("POST", "/api/expenses", { amount: 450, category: "Food & Dining", merchant: "Zomato", spent_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()), source: "nl" });
  const expId = r.json.expense?.id; check("add expense", r.status === 201 && expId, `time stamped: ${r.json.expense?.spent_at}`);
  r = await call("DELETE", `/api/expenses/${expId}`); check("delete expense", r.status === 200);
  r = await call("GET", "/api/goals"); check("goals with plans", r.status === 200 && r.json.goals.length === 2 && r.json.goals.some((g) => g.plan.onTrack === false));
  r = await call("POST", "/api/budget/generate", {}); check("generate budget (saved to DB, sums to income)", r.status === 200 && r.json.budgets.reduce((s, b) => s + b.limit, 0) === 45000);
  r = await call("PUT", "/api/budgets", { budgets: [{ category: "Food & Dining", limit: 999999 }] }); check("over-income budget rejected", r.status === 400);
  r = await call("POST", "/api/future", { monthlySaving: 5000, years: 5 }); check("future you", r.status === 200 && r.json.chosen.series.length === 61 && !!r.json.narrative);
  r = await call("POST", "/api/future", { monthlySaving: 5000, years: 10, annualReturnPct: 10, lumpSum: 50000, stepUpPct: 10, real: true, narrative: false });
  check("future you: horizon, return, lump sum, step-up, today's rupees", r.status === 200 && r.json.chosen.series.length === 121 && r.json.assumptions.annualReturnPct === 10 && r.json.assumptions.lumpSum === 50000 && r.json.assumptions.real === true && r.json.milestones.length >= 3, `${r.json.milestones?.length} milestones, goalNeeds ${JSON.stringify(r.json.goalNeeds)}`);
  r = await call("POST", "/api/future", { monthlySaving: 5000, years: 5, annualReturnPct: 99 }); check("future you: absurd return rejected", r.status === 400);
  r = await call("POST", "/api/whatif", { description: "phone EMI", monthlyCost: 2500, months: 12 }); check("what-if", r.status === 200 && r.json.goalDelays.length === 2);
  r = await call("GET", "/api/nudge"); check("nudge", r.status === 200 && r.json.nudge?.text, r.json.nudge?.kind);
  r = await call("GET", "/api/triggers"); check("spending triggers", r.status === 200 && r.json.triggers.some((t) => t.id === "late_night"), r.json.triggers?.map((t) => t.id).join(","));
  r = await call("GET", "/api/personality"); check("money personality", r.status === 200 && r.json.personality?.plan?.length === 3, r.json.personality?.title);
  r = await call("POST", "/api/insights/refresh"); check("insight saved", r.status === 200 && r.json.insight?.body);
  r = await call("PUT", "/api/profile", { persona: "roast" }); check("persona -> roast", r.status === 200 && r.json.profile.persona === "roast");

  // Agent: add an expense, then confirm a proposed budget change.
  const sse = async (message) => { const res = await fetch(BASE + "/api/agent/chat", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ message }) }); return (await res.text()).split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6))); };
  let ev = await sse("aaj Uber 220"); check("agent adds expense + undo event", ev.some((e) => e.type === "undo") && ev.at(-1).type === "done");
  ev = await sse("food budget 6500 kar do"); const conf = ev.find((e) => e.type === "confirm"); check("agent proposes budget change", !!conf, conf?.summary);
  if (conf) { r = await call("POST", "/api/agent/confirm", { actionId: conf.actionId, decision: "confirm" }); check("confirm applies change", r.status === 200, r.json.message); r = await call("POST", "/api/agent/confirm", { actionId: conf.actionId, decision: "confirm" }); check("confirm is one-shot", r.status === 404); }
  r = await call("PUT", "/api/profile", { language: "hi" }); check("language -> hi", r.status === 200 && r.json.profile.language === "hi");
  r = await call("PUT", "/api/profile", { language: "klingon" }); check("unknown language rejected", r.status === 400);
  r = await call("GET", "/api/profile"); check("language persisted", r.json.profile.language === "hi");
  const goals = (await call("GET", "/api/goals")).json.goals;
  r = await call("DELETE", `/api/goals/${goals[0].id}`); check("delete goal", r.status === 200);
  r = await call("DELETE", `/api/goals/${goals[0].id}`); check("delete goal again -> 404", r.status === 404);
  r = await call("GET", "/api/chat"); check("chat history persisted", r.json.messages?.length >= 4, `${r.json.messages?.length} messages`);

  r = await call("DELETE", "/api/data?scope=chat"); r = await call("GET", "/api/chat"); check("delete chat scope", r.json.messages.length === 0);
  r = await call("DELETE", "/api/data?scope=bogus"); check("unknown scope rejected", r.status === 400);
  r = await call("DELETE", "/api/data?scope=expenses"); r = await call("GET", "/api/summary"); check("delete expenses scope", r.status === 200 && r.json.total === 0);
  r = await call("DELETE", "/api/account", {}); check("account delete needs the confirm word", r.status === 400);
  r = await call("DELETE", "/api/account", { confirm: "DELETE" }); check("delete account", r.status === 200);
  const gone = await db.query("select (select count(*) from auth.users where id = $1::text::uuid) u, (select count(*) from public.profiles where id = $1::text::uuid) p, (select count(*) from public.expenses where user_id = $1::text::uuid) e", [id]);
  check("account, profile and rows removed from the database", Number(gone.rows[0].u) === 0 && Number(gone.rows[0].p) === 0 && Number(gone.rows[0].e) === 0);
  r = await call("GET", "/api/profile"); check("old session no longer works", r.status === 401);

  // Row-level security: the same table read with only the public key and no session must show nothing.
  const anon = await fetch(`${URL_}/rest/v1/expenses?select=id&limit=5`, { headers: { apikey: KEY } });
  const anonRows = await anon.json(); check("RLS: anonymous read of expenses returns nothing", Array.isArray(anonRows) && anonRows.length === 0, `status ${anon.status}`);
  const migr = await fetch(`${URL_}/rest/v1/schema_migrations?select=*`, { headers: { apikey: KEY } });
  check("RLS: migrations table not readable by API", !(await migr.json()).length);
} catch (e) { check("script error", false, e.message); }
finally {
  await db.query("delete from auth.users where id = $1", [id]).catch((e) => console.log("cleanup error", e.message));
  const left = await db.query("select (select count(*) from public.expenses where user_id=$1) e, (select count(*) from public.profiles where id=$1) p", [id]);
  console.log(`cleanup: test user removed, leftover rows expenses=${left.rows[0].e} profiles=${left.rows[0].p}`);
  await db.end();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}
