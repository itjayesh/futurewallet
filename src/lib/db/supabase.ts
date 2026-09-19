import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Budget, ChatMessage, DataScope, Expense, Goal, Insight, PendingAction, Profile, Repo } from "./types";

/** FW_DEV_STORE=1 forces the in-memory dev store and fixed dev user even when Supabase keys are present. */
export function supabaseConfigured(): boolean {
  if (process.env.FW_DEV_STORE === "1") return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server client bound to the request's auth cookies, so row-level security applies. */
export async function serverClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component where cookies are read-only; safe to ignore.
        }
      },
    },
  });
}

/** Unwraps a PostgREST response. The client is untyped, so rows are converted by the to* helpers below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function must(res: { data: any; error: { message: string } | null }): any {
  if (res.error) throw new Error(`Database error: ${res.error.message}`);
  return res.data;
}

const num = (v: unknown) => Number(v);

const toExpense = (r: Record<string, unknown>): Expense => ({
  ...(r as unknown as Expense),
  amount: num(r.amount),
  spent_at: r.spent_at ? String(r.spent_at).slice(0, 5) : null,
});
const toBudget = (r: Record<string, unknown>): Budget => ({ ...(r as unknown as Budget), limit_amount: num(r.limit_amount) });
const toGoal = (r: Record<string, unknown>): Goal => ({
  ...(r as unknown as Goal),
  target_amount: num(r.target_amount),
  saved_amount: num(r.saved_amount),
});
const toProfile = (r: Record<string, unknown>): Profile => ({
  ...(r as unknown as Profile),
  monthly_income: num(r.monthly_income),
});

export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    async getProfile(userId) {
      const row = must(await db.from("profiles").select("*").eq("id", userId).maybeSingle());
      return row ? toProfile(row) : null;
    },
    async upsertProfile(userId, patch) {
      const row = must(await db.from("profiles").upsert({ id: userId, ...patch }).select().single());
      return toProfile(row);
    },

    async listExpenses(userId, range = {}) {
      let q = db.from("expenses").select("*").eq("user_id", userId);
      if (range.from) q = q.gte("spent_on", range.from);
      if (range.to) q = q.lte("spent_on", range.to);
      const rows = must(await q.order("spent_on", { ascending: false }).order("created_at", { ascending: false }));
      return rows.map(toExpense);
    },
    async addExpenses(userId, items) {
      if (items.length === 0) return [];
      const rows = must(await db.from("expenses").insert(items.map((i) => ({ ...i, user_id: userId }))).select());
      return rows.map(toExpense);
    },
    async deleteExpense(userId, id) {
      const rows = must(await db.from("expenses").delete().eq("id", id).eq("user_id", userId).select("id"));
      return rows.length > 0;
    },

    async listBudgets(userId, month) {
      const rows = must(await db.from("budgets").select("*").eq("user_id", userId).eq("month", month));
      return rows.map(toBudget);
    },
    async replaceBudgets(userId, month, lines) {
      must(await db.from("budgets").delete().eq("user_id", userId).eq("month", month).select("id"));
      if (lines.length === 0) return [];
      const rows = must(await db.from("budgets").insert(lines.map((l) => ({ ...l, user_id: userId, month }))).select());
      return rows.map(toBudget);
    },

    async listGoals(userId) {
      const rows = must(await db.from("goals").select("*").eq("user_id", userId).order("created_at"));
      return rows.map(toGoal);
    },
    async createGoal(userId, goal) {
      return toGoal(must(await db.from("goals").insert({ ...goal, user_id: userId }).select().single()));
    },
    async contribute(userId, goalId, amount) {
      const current = must(await db.from("goals").select("*").eq("id", goalId).eq("user_id", userId).maybeSingle());
      if (!current) return null;
      const updated = must(
        await db
          .from("goals")
          .update({ saved_amount: num(current.saved_amount) + amount })
          .eq("id", goalId)
          .eq("user_id", userId)
          .select()
          .single(),
      );
      return toGoal(updated);
    },

    async deleteGoal(userId, goalId) {
      const rows = must(await db.from("goals").delete().eq("id", goalId).eq("user_id", userId).select("id"));
      return rows.length > 0;
    },

    async latestInsight(userId, kind) {
      const row = must(
        await db.from("insights").select("*").eq("user_id", userId).eq("kind", kind).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      );
      return (row as Insight | null) ?? null;
    },
    async saveInsight(userId, kind, body) {
      return must(await db.from("insights").insert({ user_id: userId, kind, body }).select().single()) as Insight;
    },

    async listChat(userId, limit) {
      const rows = must(await db.from("chat_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit));
      return (rows as ChatMessage[]).reverse();
    },
    async addChat(userId, role, content) {
      return must(await db.from("chat_messages").insert({ user_id: userId, role, content }).select().single()) as ChatMessage;
    },

    async savePendingAction(userId, tool, args, summary) {
      return must(await db.from("pending_actions").insert({ user_id: userId, tool, args, summary }).select().single()) as PendingAction;
    },
    async takePendingAction(userId, id) {
      const rows = must(await db.from("pending_actions").delete().eq("id", id).eq("user_id", userId).select());
      return (rows[0] as PendingAction | undefined) ?? null;
    },

    async clearUserData(userId) {
      for (const table of ["expenses", "budgets", "goals", "insights", "chat_messages", "pending_actions"]) {
        must(await db.from(table).delete().eq("user_id", userId).select("id"));
      }
    },

    async deleteData(userId, scope: DataScope) {
      if (scope === "all") return this.clearUserData(userId);
      const table = { expenses: "expenses", budgets: "budgets", goals: "goals", insights: "insights", chat: "chat_messages" }[scope];
      must(await db.from(table).delete().eq("user_id", userId).select("id"));
    },

    /** The database function removes the auth user, and every table cascades from it. */
    async deleteAccount() {
      must(await db.rpc("delete_my_account"));
      await db.auth.signOut();
    },
  };
}
