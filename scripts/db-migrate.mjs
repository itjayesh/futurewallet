// Applies supabase/migrations/*.sql in order, once each. Usage: npm run db:migrate
// Reads SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD from .env.local (never printed).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!host || !password) {
  console.error("Set SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD in .env.local first.");
  process.exit(1);
}

const client = new pg.Client({
  host,
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

try {
  await client.connect();
  await client.query("create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  // No policies on purpose: with RLS on, the public API cannot read or write this bookkeeping table.
  await client.query("alter table public.schema_migrations enable row level security");
  const { rows } = await client.query("select name from public.schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${file} failed: ${err.message}`);
    }
  }
  const tables = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
  console.log("public tables:", tables.rows.map((r) => r.table_name).join(", "));
  const open = await client.query("select tablename from pg_tables where schemaname = 'public' and not rowsecurity");
  console.log(open.rows.length ? `WARNING: RLS is OFF on: ${open.rows.map((r) => r.tablename).join(", ")}` : "RLS is on for every public table.");
} catch (err) {
  console.error("Migration error:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
