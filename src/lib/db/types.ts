import type { Persona } from "@/lib/ai/personas";

export type FixedCostRow = { name: string; category: string; amount: number };

/** Interface and advisor language: English, Hinglish (Hindi in Roman letters) or Hindi (Devanagari). */
export type Language = "en" | "hinglish" | "hi";
export const LANGUAGES: readonly Language[] = ["en", "hinglish", "hi"];

/** What a "delete" action in Settings removes. "all" clears data but keeps the profile and the account. */
export type DataScope = "expenses" | "budgets" | "goals" | "chat" | "insights" | "all";

export interface Profile {
  id: string;
  name: string;
  monthly_income: number;
  fixed_costs: FixedCostRow[];
  persona: Persona;
  language: Language;
  created_at: string;
}

export type ExpenseSource = "manual" | "nl" | "csv" | "seed";

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  merchant: string;
  note: string;
  spent_on: string; // YYYY-MM-DD
  spent_at: string | null; // HH:MM
  source: ExpenseSource;
  created_at: string;
}
export type NewExpense = Omit<Expense, "id" | "user_id" | "created_at">;

export interface Budget {
  id: string;
  user_id: string;
  month: string; // first day of month, YYYY-MM-01
  category: string;
  limit_amount: number;
  reason: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  deadline: string;
  created_at: string;
}
export type NewGoal = Pick<Goal, "title" | "target_amount" | "deadline"> & { saved_amount?: number };

export interface Insight {
  id: string;
  user_id: string;
  kind: string;
  body: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PendingAction {
  id: string;
  user_id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  created_at: string;
}

/** Every method is scoped to one user. The user id comes from the session, never from a request body. */
export interface Repo {
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(userId: string, patch: Partial<Omit<Profile, "id" | "created_at">>): Promise<Profile>;

  listExpenses(userId: string, range?: { from?: string; to?: string }): Promise<Expense[]>;
  addExpenses(userId: string, items: NewExpense[]): Promise<Expense[]>;
  deleteExpense(userId: string, id: string): Promise<boolean>;

  listBudgets(userId: string, month: string): Promise<Budget[]>;
  replaceBudgets(
    userId: string,
    month: string,
    lines: { category: string; limit_amount: number; reason: string }[],
  ): Promise<Budget[]>;

  listGoals(userId: string): Promise<Goal[]>;
  createGoal(userId: string, goal: NewGoal): Promise<Goal>;
  contribute(userId: string, goalId: string, amount: number): Promise<Goal | null>;
  deleteGoal(userId: string, goalId: string): Promise<boolean>;

  latestInsight(userId: string, kind: string): Promise<Insight | null>;
  saveInsight(userId: string, kind: string, body: string): Promise<Insight>;

  listChat(userId: string, limit: number): Promise<ChatMessage[]>;
  addChat(userId: string, role: ChatMessage["role"], content: string): Promise<ChatMessage>;

  savePendingAction(userId: string, tool: string, args: Record<string, unknown>, summary: string): Promise<PendingAction>;
  takePendingAction(userId: string, id: string): Promise<PendingAction | null>;

  /** Deletes expenses, budgets, goals, insights and chat for the user; keeps the profile. */
  clearUserData(userId: string): Promise<void>;
  /** Deletes one kind of data for the user. */
  deleteData(userId: string, scope: DataScope): Promise<void>;
  /** Removes the profile and every row the user owns, and the sign-in itself where the backend allows it. */
  deleteAccount(userId: string): Promise<void>;
}
