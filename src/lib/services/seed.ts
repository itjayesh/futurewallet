import { addMonths, daysInMonth, firstOfMonth, lastMonths, lastOfMonth, monthOf } from "@/lib/dates";
import type { NewExpense, Repo } from "@/lib/db/types";
import { normalizeBudget, type BudgetLine, type FixedCost } from "@/lib/finance";

/** Deterministic PRNG so the demo looks the same on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO = {
  name: "Meera",
  income: 45_000,
  fixedCosts: [
    { name: "Rent", category: "Rent & EMI", amount: 16_000 },
    { name: "Internet and utilities", category: "Bills & Utilities", amount: 1_800 },
  ],
};

type Fixed = { day: number; category: string; merchant: string; min: number; max: number };
type Variable = {
  category: string;
  merchants: string[];
  count: [number, number];
  amount: [number, number];
  /** "delivery" orders can land late at night; "day" get a daytime hour; null has no time. */
  time: "delivery" | "day" | null;
};

const FIXED: Fixed[] = [
  { day: 1, category: "Rent & EMI", merchant: "Rent", min: 16_000, max: 16_000 },
  { day: 5, category: "Bills & Utilities", merchant: "Airtel Broadband", min: 1_800, max: 1_800 },
  { day: 9, category: "Bills & Utilities", merchant: "BSES Electricity", min: 950, max: 1_350 },
  { day: 12, category: "Subscriptions", merchant: "Spotify", min: 119, max: 119 },
  { day: 15, category: "Subscriptions", merchant: "Netflix", min: 649, max: 649 },
  { day: 20, category: "Subscriptions", merchant: "YouTube Premium", min: 149, max: 149 },
];

const VARIABLE: Variable[] = [
  { category: "Food & Dining", merchants: ["Zomato", "Swiggy"], count: [14, 17], amount: [290, 520], time: "delivery" },
  { category: "Food & Dining", merchants: ["Chaayos", "Third Wave Coffee"], count: [3, 5], amount: [140, 340], time: "day" },
  { category: "Groceries", merchants: ["Blinkit", "Zepto", "BigBasket"], count: [7, 9], amount: [260, 720], time: "day" },
  { category: "Transport", merchants: ["Uber", "Rapido", "Ola"], count: [9, 12], amount: [110, 340], time: "day" },
  { category: "Transport", merchants: ["Delhi Metro"], count: [1, 1], amount: [500, 500], time: null },
  { category: "Shopping", merchants: ["Amazon", "Myntra", "Decathlon"], count: [2, 3], amount: [620, 1_500], time: "day" },
  { category: "Entertainment", merchants: ["BookMyShow", "PVR Cinemas"], count: [1, 2], amount: [320, 640], time: null },
  { category: "Health", merchants: ["Apollo Pharmacy", "1mg"], count: [1, 2], amount: [280, 560], time: null },
  { category: "Other", merchants: ["Cash withdrawal", "Miscellaneous"], count: [1, 2], amount: [200, 400], time: null },
];

const BUDGET_LIMITS: Record<string, number> = {
  "Rent & EMI": 16_000,
  "Bills & Utilities": 3_000,
  "Food & Dining": 7_500,
  Groceries: 3_500,
  Transport: 2_500,
  Shopping: 2_000,
  Entertainment: 1_500,
  Subscriptions: 900,
  Health: 800,
  Other: 500,
};

const pad = (n: number) => String(n).padStart(2, "0");

function generateMonth(month: string, today: string, rnd: () => number, lateNightRate: number): NewExpense[] {
  const isCurrent = month === monthOf(today);
  const maxDay = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month);
  const frac = maxDay / daysInMonth(month);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const out: NewExpense[] = [];
  const add = (category: string, merchant: string, amount: number, day: number, time: string | null) =>
    out.push({
      amount: Math.round(amount),
      category,
      merchant,
      note: "",
      spent_on: `${month}-${pad(day)}`,
      spent_at: time,
      source: "seed",
    });

  for (const f of FIXED) if (f.day <= maxDay) add(f.category, f.merchant, between(f.min, f.max), f.day, null);

  for (const v of VARIABLE) {
    const count = Math.round(between(v.count[0], v.count[1] + 0.99) * frac);
    for (let i = 0; i < count; i++) {
      const day = 1 + Math.floor(rnd() * maxDay);
      let time: string | null = null;
      if (v.time === "delivery") {
        if (rnd() < lateNightRate) time = `23:${pad(5 + Math.floor(rnd() * 50))}`;
        else time = `${pad(pick([12, 13, 14, 19, 20, 21]))}:${pad(Math.floor(rnd() * 60))}`;
      } else if (v.time === "day") {
        time = `${pad(9 + Math.floor(rnd() * 12))}:${pad(Math.floor(rnd() * 60))}`;
      }
      add(v.category, pick(v.merchants), between(v.amount[0], v.amount[1]), day, time);
    }
  }

  // The deliberate impulse pattern: a late-night purchase in the two most recent months.
  if (lateNightRate > 0.3 && maxDay >= 12) add("Shopping", "Amazon", between(1_100, 1_600), 11, "23:32");
  return out;
}

/** Replaces the user's data with 5 full months plus this month so far, a budget and two goals. */
export async function seedDemo(repo: Repo, userId: string, today: string) {
  const existing = await repo.getProfile(userId);
  await repo.clearUserData(userId);
  await repo.upsertProfile(userId, {
    name: DEMO.name,
    monthly_income: DEMO.income,
    fixed_costs: DEMO.fixedCosts,
    persona: existing?.persona ?? "friendly",
  });

  const thisMonth = monthOf(today);
  const months = lastMonths(thisMonth, 6);
  const rows: NewExpense[] = [];
  months.forEach((m, i) => {
    const recent = i >= months.length - 2;
    rows.push(...generateMonth(m, today, mulberry32(Number(m.replace("-", ""))), recent ? 0.55 : 0.2));
  });
  await repo.addExpenses(userId, rows);

  // Budget from the completed months' averages, made consistent by code.
  const history = months.slice(0, -1).slice(-3);
  const averages = new Map<string, number>();
  for (const r of rows) {
    if (!history.includes(monthOf(r.spent_on))) continue;
    averages.set(r.category, (averages.get(r.category) ?? 0) + r.amount / history.length);
  }
  const proposal: BudgetLine[] = Object.entries(BUDGET_LIMITS).map(([category, limit]) => {
    const avg = Math.round(averages.get(category) ?? 0);
    return {
      category,
      limit,
      reason: avg > 0 ? `Your 3-month average is ₹${avg.toLocaleString("en-IN")}.` : "No spending recorded yet.",
    };
  });
  const fixed: FixedCost[] = DEMO.fixedCosts.map(({ category, amount }) => ({ category, amount }));
  const lines = normalizeBudget(DEMO.income, fixed, proposal);
  await repo.replaceBudgets(
    userId,
    firstOfMonth(thisMonth),
    lines.map((l) => ({ category: l.category, limit_amount: l.limit, reason: l.reason })),
  );

  await repo.createGoal(userId, {
    title: "Laptop",
    target_amount: 60_000,
    saved_amount: 12_000,
    deadline: lastOfMonth(addMonths(thisMonth, 7)),
  });
  await repo.createGoal(userId, {
    title: "Emergency fund",
    target_amount: 50_000,
    saved_amount: 20_000,
    deadline: lastOfMonth(addMonths(thisMonth, 13)),
  });

  return { expenses: rows.length, months: months.length };
}
