import type {
  Budget,
  ChatMessage,
  Expense,
  Goal,
  Insight,
  PendingAction,
  Profile,
  Repo,
} from "./types";

type UserData = {
  profile: Profile | null;
  expenses: Expense[];
  budgets: Budget[];
  goals: Goal[];
  insights: Insight[];
  chat: ChatMessage[];
  pending: PendingAction[];
};

const now = () => new Date().toISOString();
const empty = (): UserData => ({ profile: null, expenses: [], budgets: [], goals: [], insights: [], chat: [], pending: [] });

/**
 * In-memory repo for local development without Supabase. Data lives in the
 * server process and is lost on restart. Kept on globalThis so hot reload keeps it.
 */
export function createMemoryRepo(): Repo {
  const g = globalThis as unknown as { __fwMemory?: Map<string, UserData> };
  const users = (g.__fwMemory ??= new Map<string, UserData>());
  const data = (userId: string) => {
    let d = users.get(userId);
    if (!d) users.set(userId, (d = empty()));
    return d;
  };

  return {
    async getProfile(userId) {
      return data(userId).profile;
    },
    async upsertProfile(userId, patch) {
      const d = data(userId);
      d.profile = {
        id: userId,
        name: "",
        monthly_income: 0,
        fixed_costs: [],
        persona: "friendly",
        language: "en",
        created_at: now(),
        ...d.profile,
        ...patch,
      };
      return d.profile;
    },

    async listExpenses(userId, range = {}) {
      return data(userId)
        .expenses.filter((e) => (!range.from || e.spent_on >= range.from) && (!range.to || e.spent_on <= range.to))
        .sort((a, b) => (a.spent_on === b.spent_on ? b.created_at.localeCompare(a.created_at) : b.spent_on.localeCompare(a.spent_on)));
    },
    async addExpenses(userId, items) {
      const d = data(userId);
      const created = items.map<Expense>((i) => ({ ...i, id: crypto.randomUUID(), user_id: userId, created_at: now() }));
      d.expenses.push(...created);
      return created;
    },
    async deleteExpense(userId, id) {
      const d = data(userId);
      const before = d.expenses.length;
      d.expenses = d.expenses.filter((e) => e.id !== id);
      return d.expenses.length < before;
    },

    async listBudgets(userId, month) {
      return data(userId).budgets.filter((b) => b.month === month);
    },
    async replaceBudgets(userId, month, lines) {
      const d = data(userId);
      d.budgets = d.budgets.filter((b) => b.month !== month);
      const created = lines.map<Budget>((l) => ({ ...l, id: crypto.randomUUID(), user_id: userId, month }));
      d.budgets.push(...created);
      return created;
    },

    async listGoals(userId) {
      return [...data(userId).goals].sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    async createGoal(userId, goal) {
      const g2: Goal = { saved_amount: 0, ...goal, id: crypto.randomUUID(), user_id: userId, created_at: now() };
      data(userId).goals.push(g2);
      return g2;
    },
    async contribute(userId, goalId, amount) {
      const goal = data(userId).goals.find((g) => g.id === goalId);
      if (!goal) return null;
      goal.saved_amount += amount;
      return goal;
    },

    async deleteGoal(userId, goalId) {
      const d = data(userId);
      const before = d.goals.length;
      d.goals = d.goals.filter((g) => g.id !== goalId);
      return d.goals.length < before;
    },

    async latestInsight(userId, kind) {
      const list = data(userId).insights.filter((i) => i.kind === kind);
      return list.length ? list[list.length - 1] : null;
    },
    async saveInsight(userId, kind, body) {
      const insight: Insight = { id: crypto.randomUUID(), user_id: userId, kind, body, created_at: now() };
      data(userId).insights.push(insight);
      return insight;
    },

    async listChat(userId, limit) {
      return data(userId).chat.slice(-limit);
    },
    async addChat(userId, role, content) {
      const m: ChatMessage = { id: crypto.randomUUID(), user_id: userId, role, content, created_at: now() };
      data(userId).chat.push(m);
      return m;
    },

    async savePendingAction(userId, tool, args, summary) {
      const p: PendingAction = { id: crypto.randomUUID(), user_id: userId, tool, args, summary, created_at: now() };
      data(userId).pending.push(p);
      return p;
    },
    async takePendingAction(userId, id) {
      const d = data(userId);
      const found = d.pending.find((p) => p.id === id) ?? null;
      if (found) d.pending = d.pending.filter((p) => p.id !== id);
      return found;
    },

    async deleteData(userId, scope) {
      const d = data(userId);
      if (scope === "expenses" || scope === "all") d.expenses = [];
      if (scope === "budgets" || scope === "all") d.budgets = [];
      if (scope === "goals" || scope === "all") d.goals = [];
      if (scope === "insights" || scope === "all") d.insights = [];
      if (scope === "chat" || scope === "all") d.chat = [];
      if (scope === "all") d.pending = [];
    },

    async deleteAccount(userId) {
      users.delete(userId);
    },

    async clearUserData(userId) {
      const d = data(userId);
      d.expenses = [];
      d.budgets = [];
      d.goals = [];
      d.insights = [];
      d.chat = [];
      d.pending = [];
    },
  };
}
