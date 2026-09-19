import { addMonths, daysInMonth, monthLabel, monthOf } from "@/lib/dates";
import type { Expense } from "@/lib/db/types";
import { DISCRETIONARY } from "@/lib/finance";
import { buildSummary, type Ctx } from "./context";
import { computeFuture } from "./future";
import { detectPersonality, type Personality } from "./patterns";

/**
 * Everything the "Wrapped" story shows, computed by code from this month's real spending.
 * Slides that have no data behind them come back as null, and the screen skips them.
 */

const FIXED = new Set(["Rent & EMI", "Bills & Utilities"]);
const DELIVERY = /zomato|swiggy|eatsure|domino|pizza hut|kfc|mcdonald|burger king/i;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);
const isDisc = (e: Expense) => (DISCRETIONARY as readonly string[]).includes(e.category);
const dow = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export interface Wrapped {
  name: string;
  month: string;
  monthLabel: string;
  monthName: string;
  /** Days of the month covered so far. */
  daysCovered: number;
  total: number;
  txCount: number;
  perDay: number;
  /** Change against the same days of last month, in percent. Null when last month has no data. */
  vsLastMonthPct: number | null;
  topCategories: { category: string; amount: number; sharePct: number }[];
  topMerchant: { merchant: string; amount: number; count: number } | null;
  delivery: { orders: number; spend: number } | null;
  lateNight: { spend: number; count: number; sharePct: number } | null;
  weekday: { label: string; name: string; amount: number }[];
  busiestDay: { name: string; amount: number } | null;
  biggest: { merchant: string; category: string; amount: number; date: string } | null;
  noSpend: { days: number; longestStreak: number; calendar: { day: number; spent: boolean }[] };
  personality: Personality;
  healthScore: number;
  future: { monthlySaving: number; years: number; current: number; chosen: number; difference: number };
}

export function buildWrapped(ctx: Ctx): Wrapped {
  const month = ctx.month;
  const isCurrent = month === monthOf(ctx.today);
  const daysCovered = isCurrent ? Number(ctx.today.slice(8, 10)) : daysInMonth(month);
  const cur = ctx.current;
  const total = Math.round(sum(cur));
  const nonFixed = cur.filter((e) => !FIXED.has(e.category));

  // Same days of last month, so a half-finished month is not compared with a whole one.
  const prevMonth = addMonths(month, -1);
  const prev = ctx.expenses.filter((e) => monthOf(e.spent_on) === prevMonth && Number(e.spent_on.slice(8, 10)) <= daysCovered);
  const prevTotal = sum(prev);

  const summary = buildSummary(ctx);
  const topCategories = summary.byCategory.slice(0, 3).map((c) => ({ category: c.category, amount: c.amount, sharePct: Math.round(c.share) }));

  const merchants = new Map<string, { amount: number; count: number }>();
  for (const e of nonFixed) {
    if (!e.merchant) continue;
    const m = merchants.get(e.merchant) ?? { amount: 0, count: 0 };
    m.amount += e.amount;
    m.count += 1;
    merchants.set(e.merchant, m);
  }
  const top = [...merchants.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];

  const delivery = cur.filter((e) => e.category === "Food & Dining" && DELIVERY.test(e.merchant));
  const disc = cur.filter(isDisc);
  const late = disc.filter((e) => e.spent_at !== null && Number(e.spent_at.slice(0, 2)) >= 23);

  const weekday = SHORT.map((label, i) => ({
    label,
    name: WEEKDAYS[i],
    amount: Math.round(sum(nonFixed.filter((e) => dow(e.spent_on) === i))),
  }));
  // Monday first, the way people think about a week.
  weekday.push(weekday.shift()!);
  const busiest = [...weekday].sort((a, b) => b.amount - a.amount)[0];

  const big = [...nonFixed].sort((a, b) => b.amount - a.amount)[0];

  const calendar: { day: number; spent: boolean }[] = [];
  let longest = 0;
  let run = 0;
  for (let d = 1; d <= daysCovered; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const spent = disc.some((e) => e.spent_on === date);
    calendar.push({ day: d, spent });
    run = spent ? 0 : run + 1;
    longest = Math.max(longest, run);
  }

  const future = computeFuture(ctx, 5000, 5).facts;
  return {
    name: ctx.profile.name,
    month,
    monthLabel: monthLabel(month),
    monthName: monthLabel(month).split(" ")[0],
    daysCovered,
    total,
    txCount: cur.length,
    perDay: Math.round(total / Math.max(1, daysCovered)),
    vsLastMonthPct: prevTotal > 0 ? Math.round(((sum(cur) - prevTotal) / prevTotal) * 100) : null,
    topCategories,
    topMerchant: top ? { merchant: top[0], amount: Math.round(top[1].amount), count: top[1].count } : null,
    delivery: delivery.length >= 3 ? { orders: delivery.length, spend: Math.round(sum(delivery)) } : null,
    lateNight: late.length >= 2 ? { spend: Math.round(sum(late)), count: late.length, sharePct: Math.round((sum(late) / Math.max(1, sum(disc))) * 100) } : null,
    weekday,
    busiestDay: busiest && busiest.amount > 0 ? { name: busiest.name, amount: busiest.amount } : null,
    biggest: big ? { merchant: big.merchant || big.category, category: big.category, amount: Math.round(big.amount), date: big.spent_on } : null,
    noSpend: { days: calendar.filter((c) => !c.spent).length, longestStreak: longest, calendar },
    personality: detectPersonality(ctx),
    healthScore: summary.healthScore,
    future: {
      monthlySaving: future.chosen.monthlySaving,
      years: future.years,
      current: future.current.endBalance,
      chosen: future.chosen.endBalance,
      difference: future.difference,
    },
  };
}

