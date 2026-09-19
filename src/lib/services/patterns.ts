import { addDays, monthOf } from "@/lib/dates";
import type { Expense } from "@/lib/db/types";
import { DISCRETIONARY } from "@/lib/finance";
import { inr } from "@/lib/format";
import type { Ctx } from "./context";

/**
 * Behaviour patterns found by code over the last 90 days of discretionary spending.
 * Everything the user sees (personality, triggers) is built from these numbers, so it is always true to the data.
 */

const WINDOW_DAYS = 90;
const DELIVERY = /zomato|swiggy|eatsure|domino|pizza hut|kfc|mcdonald|burger king/i;
const disc = (e: Expense) => (DISCRETIONARY as readonly string[]).includes(e.category);
const lateNight = (e: Expense) => e.spent_at !== null && Number(e.spent_at.slice(0, 2)) >= 23;
const isWeekend = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
};
const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);

export interface Patterns {
  days: number;
  months: number;
  discretionaryTotal: number;
  lateNight: { spend: number; count: number; share: number; perMonth: number };
  weekend: { share: number; perDayRatio: number };
  delivery: { orders: number; perMonth: number; spend: number };
  subscriptions: { merchants: number; perMonth: number };
  paydayWindow: { perDayRatio: number };
  topMerchant: { merchant: string; spend: number } | null;
  fixedShare: number;
  savingRate: number;
}

export function analyse(ctx: Ctx): Patterns {
  const from = addDays(ctx.today, -(WINDOW_DAYS - 1));
  const all = ctx.expenses.filter((e) => e.spent_on >= from && e.spent_on <= ctx.today);
  const d = all.filter(disc);
  const total = sum(d) || 1;
  const months = WINDOW_DAYS / 30.4375;

  const late = d.filter(lateNight);
  const weekend = d.filter((e) => isWeekend(e.spent_on));
  const weekendDays = countDays(from, ctx.today, true);
  const weekdayDays = countDays(from, ctx.today, false);
  const weekendPerDay = sum(weekend) / Math.max(1, weekendDays);
  const weekdayPerDay = (sum(d) - sum(weekend)) / Math.max(1, weekdayDays);

  const delivery = all.filter((e) => e.category === "Food & Dining" && DELIVERY.test(e.merchant));
  const subs = all.filter((e) => e.category === "Subscriptions");

  // Days 2 to 4 of the month, when a salary has usually just landed (rent on the 1st is excluded as non-discretionary).
  const early = d.filter((e) => ["02", "03", "04"].includes(e.spent_on.slice(8, 10)));
  const rest = d.filter((e) => !["02", "03", "04"].includes(e.spent_on.slice(8, 10)));
  const monthsSeen = new Set(d.map((e) => monthOf(e.spent_on))).size || 1;
  const earlyPerDay = sum(early) / (3 * monthsSeen);
  const restPerDay = sum(rest) / Math.max(1, WINDOW_DAYS - 3 * monthsSeen);

  const byMerchant = new Map<string, number>();
  for (const e of d) if (e.merchant) byMerchant.set(e.merchant, (byMerchant.get(e.merchant) ?? 0) + e.amount);
  const top = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0];

  const income = ctx.profile.monthly_income;
  return {
    days: WINDOW_DAYS,
    months,
    discretionaryTotal: Math.round(total),
    lateNight: { spend: Math.round(sum(late)), count: late.length, share: sum(late) / total, perMonth: Math.round(sum(late) / months) },
    weekend: { share: sum(weekend) / total, perDayRatio: weekdayPerDay > 0 ? weekendPerDay / weekdayPerDay : 0 },
    delivery: { orders: delivery.length, perMonth: delivery.length / months, spend: Math.round(sum(delivery)) },
    subscriptions: { merchants: new Set(subs.map((e) => e.merchant)).size, perMonth: Math.round(sum(subs) / months) },
    paydayWindow: { perDayRatio: restPerDay > 0 ? earlyPerDay / restPerDay : 0 },
    topMerchant: top ? { merchant: top[0], spend: Math.round(top[1]) } : null,
    fixedShare: income > 0 ? ctx.profile.fixed_costs.reduce((s, f) => s + f.amount, 0) / income : 0,
    savingRate: income > 0 ? ctx.avgSaving / income : 0,
  };
}

function countDays(from: string, to: string, weekend: boolean): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWeekend(d) === weekend) n++;
  return n;
}

/* ---------- spending triggers ---------- */

export interface Trigger {
  id: "late_night" | "weekend" | "payday";
  headline: string;
  detail: string;
  nudge: string;
}

/** The "why" behind spending: when it happens, not only what. Only patterns that clear a real threshold are returned. */
export function detectTriggers(ctx: Ctx): Trigger[] {
  const p = analyse(ctx);
  const out: Trigger[] = [];

  if (p.lateNight.share >= 0.1 && p.lateNight.count >= 3) {
    out.push({
      id: "late_night",
      headline: `${Math.round(p.lateNight.share * 100)}% of your discretionary spend happens after 11 pm`,
      detail: `${p.lateNight.count} purchases, ${inr(p.lateNight.spend)} in the last 90 days.`,
      nudge: "Before ordering after 11 pm, wait 10 minutes. If you still want it, order.",
    });
  }
  if (p.weekend.perDayRatio >= 1.5) {
    out.push({
      id: "weekend",
      headline: `Weekend days cost you ${p.weekend.perDayRatio.toFixed(1)}x a weekday`,
      detail: `${Math.round(p.weekend.share * 100)}% of discretionary spend lands on Saturday and Sunday.`,
      nudge: "Pick one weekend plan that costs nothing, and set the day's spend before you leave.",
    });
  }
  if (p.paydayWindow.perDayRatio >= 1.5) {
    out.push({
      id: "payday",
      headline: `Spending runs ${p.paydayWindow.perDayRatio.toFixed(1)}x higher on days 2 to 4 of the month`,
      detail: "That is right after money lands, when everything feels affordable.",
      nudge: "Move your savings out on day 1, before you can spend it.",
    });
  }
  return out;
}

/* ---------- money personality ---------- */

export type PersonalityId = "impulse_sniper" | "delivery_devotee" | "weekend_warrior" | "subscription_zombie" | "fixed_cost_fortress" | "steady_saver" | "balanced";

export interface Personality {
  id: PersonalityId;
  title: string;
  tagline: string;
  stats: { label: string; value: string }[];
  plan: string[];
  /** 0 to 1: how strongly the data points to this personality. */
  strength: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const hundreds = (n: number) => Math.max(100, Math.round(n / 100) * 100);

export function detectPersonality(ctx: Ctx): Personality {
  const p = analyse(ctx);
  const top = p.topMerchant ? `${p.topMerchant.merchant} ${inr(p.topMerchant.spend)}` : "None yet";

  const candidates: (Personality & { score: number })[] = [
    {
      id: "impulse_sniper",
      title: "Impulse Sniper",
      tagline: "Calm all day. Strikes after 11 pm.",
      score: p.lateNight.share >= 0.1 ? clamp01(p.lateNight.share / 0.25) : 0,
      strength: 0,
      stats: [
        { label: "After 11 pm", value: `${Math.round(p.lateNight.share * 100)}% of discretionary` },
        { label: "Late-night spend", value: `${inr(p.lateNight.perMonth)} a month` },
        { label: "Top merchant", value: top },
      ],
      plan: [
        "Wait 10 minutes before any order after 11 pm.",
        `Cap late-night purchases at 3 a month. That keeps about ${inr(hundreds(p.lateNight.perMonth * 0.6))}.`,
        "Move the delivery apps off your home screen.",
      ],
    },
    {
      id: "delivery_devotee",
      title: "Delivery Devotee",
      tagline: "Your kitchen is a rumour.",
      score: p.delivery.perMonth >= 10 ? clamp01(p.delivery.perMonth / 20) : 0,
      strength: 0,
      stats: [
        { label: "Delivery orders", value: `${Math.round(p.delivery.perMonth)} a month` },
        { label: "Spent on delivery", value: `${inr(p.delivery.spend)} in 90 days` },
        { label: "Top merchant", value: top },
      ],
      plan: [
        "Pick 3 delivery-free days a week and put them in your calendar.",
        `Cut orders by a third. That keeps about ${inr(hundreds((p.delivery.spend / p.months) / 3))} a month.`,
        "Cook one batch on Sunday for the first two weekdays.",
      ],
    },
    {
      id: "weekend_warrior",
      title: "Weekend Warrior",
      tagline: "Monday to Friday you are a monk. Saturday, a legend.",
      score: p.weekend.perDayRatio >= 1.5 ? clamp01((p.weekend.perDayRatio - 1) / 2) : 0,
      strength: 0,
      stats: [
        { label: "Weekend day vs weekday", value: `${p.weekend.perDayRatio.toFixed(1)}x` },
        { label: "Share on weekends", value: `${Math.round(p.weekend.share * 100)}% of discretionary` },
        { label: "Top merchant", value: top },
      ],
      plan: ["Set a spend limit for the weekend before Friday ends.", "Keep one weekend plan free by default.", "Pay for weekend plans with cash you withdrew, not a card."],
    },
    {
      id: "subscription_zombie",
      title: "Subscription Zombie",
      tagline: "Paying monthly for things you forgot you have.",
      score: p.subscriptions.merchants >= 4 || p.subscriptions.perMonth >= 1500 ? 0.8 : 0,
      strength: 0,
      stats: [
        { label: "Subscriptions", value: `${p.subscriptions.merchants} active` },
        { label: "Cost", value: `${inr(p.subscriptions.perMonth)} a month` },
        { label: "Top merchant", value: top },
      ],
      plan: ["List every subscription and cancel the one you used least last month.", "Move renewals to one date so you notice them.", "Set a reminder 3 days before each annual renewal."],
    },
    {
      id: "fixed_cost_fortress",
      title: "Fixed-Cost Fortress",
      tagline: "Most of your money is spoken for before the month starts.",
      score: p.fixedShare >= 0.5 ? clamp01(p.fixedShare / 0.7) : 0,
      strength: 0,
      stats: [
        { label: "Fixed costs", value: `${Math.round(p.fixedShare * 100)}% of income` },
        { label: "You save", value: `${Math.round(p.savingRate * 100)}% of income` },
        { label: "Top merchant", value: top },
      ],
      plan: ["Protect the flexible part: set one weekly cash limit and stick to it.", "Look at the biggest fixed cost once a year and renegotiate it.", "Any raise goes 50% to savings before it touches your lifestyle."],
    },
    {
      id: "steady_saver",
      title: "Steady Saver",
      tagline: "Boring on purpose. The future thanks you.",
      score: p.savingRate >= 0.2 ? 0.6 + clamp01((p.savingRate - 0.2) / 0.4) * 0.4 : 0,
      strength: 0,
      stats: [
        { label: "You save", value: `${Math.round(p.savingRate * 100)}% of income` },
        { label: "Late-night share", value: `${Math.round(p.lateNight.share * 100)}%` },
        { label: "Top merchant", value: top },
      ],
      plan: ["Automate the saving on day 1 so it never depends on willpower.", "Give your savings a job: name a goal for it.", "Review once a month. Do not fiddle in between."],
    },
  ];

  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score === 0) {
    return {
      id: "balanced",
      title: "Balanced Spender",
      tagline: "No single habit is running the show yet.",
      strength: 0,
      stats: [
        { label: "You save", value: `${Math.round(p.savingRate * 100)}% of income` },
        { label: "Late-night share", value: `${Math.round(p.lateNight.share * 100)}%` },
        { label: "Top merchant", value: top },
      ],
      plan: ["Keep logging so patterns show up early.", "Set a goal to give your savings a purpose.", "Check the Spending triggers card once a week."],
    };
  }
  const { score, ...personality } = best;
  return { ...personality, strength: Math.round(score * 100) / 100 };
}
