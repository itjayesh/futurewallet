"use client";

import { useState, type ReactNode } from "react";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr, inrCompact } from "@/lib/format";
import { motion, useReducedMotion } from "./motion";
import { cx } from "./ui";

/**
 * Chart colours come from CSS variables so light and dark each use their own validated steps.
 * Grid and axes are solid hairlines one shade off the surface; text uses text tokens, never a series colour.
 */
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
const OTHER = "var(--chart-other)";
const INK = "var(--on-surface)";
const MUTED = "var(--secondary)";
const SURFACE = "var(--surface-container-lowest)";

const tooltipStyle = {
  background: SURFACE,
  border: "1px solid var(--outline-variant)",
  borderRadius: 8,
  fontSize: 14,
  color: INK,
  boxShadow: "none",
} as const;

/** Card body with a Chart / Table switch, so every value is reachable without hover or colour. */
export function ChartFrame({
  title,
  aside,
  chart,
  table,
  className,
}: {
  title: string;
  aside?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-headline text-base font-semibold text-on-surface">{title}</h2>
        <div className="flex items-center gap-3">
          {aside ? <span className="hidden text-xs text-secondary sm:inline">{aside}</span> : null}
          <div role="group" aria-label={`${title} view`} className="inline-flex rounded-md border border-outline-variant p-0.5 text-xs">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cx("rounded px-2 py-0.5 font-medium capitalize", view === v ? "bg-surface-container text-on-surface" : "text-secondary hover:text-on-surface")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "chart" ? chart : table}
    </div>
  );
}

/* ---------- category donut ---------- */

export type CategorySlice = { category: string; amount: number; share: number };

const MAX_SLICES = 5;

/** Colour a category will have in the donut and its legend. Categories past the fifth share "Other". */
export function sliceColor(index: number): string {
  return index < MAX_SLICES ? SERIES[index] : OTHER;
}

export function CategoryDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  const reduce = useReducedMotion();
  const head = data.slice(0, MAX_SLICES);
  const tail = data.slice(MAX_SLICES);
  const slices = [...head, ...(tail.length ? [{ category: "Everything else", amount: tail.reduce((s, c) => s + c.amount, 0), share: 0 }] : [])];

  return (
    <div className="grid items-center gap-4 sm:grid-cols-12">
      <motion.div
        className="relative mx-auto h-40 w-40 sm:col-span-5"
        initial={reduce ? false : { opacity: 0, scale: 0.8, rotate: -40 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="category"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              stroke={SURFACE}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={sliceColor(i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, _n, item) => [`${inr(Number(v))} (${Math.round((Number(v) / total) * 100)}%)`, String(item?.payload?.category ?? "")]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium text-secondary">Spent</span>
          <span className="font-headline text-sm font-bold text-on-surface">{inr(total)}</span>
        </div>
      </motion.div>
      <div className="overflow-x-auto sm:col-span-7">
        <table className="w-full text-xs">
          <caption className="sr-only">Spending by category this month</caption>
          <thead>
            <tr className="border-b border-outline-variant text-secondary">
              <th className="pb-1.5 text-left font-medium">Category</th>
              <th className="pb-1.5 text-right font-medium">Amount</th>
              <th className="pb-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {data.map((c, i) => (
              <tr key={c.category}>
                <td className="flex items-center gap-2 py-1.5 text-on-surface">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: sliceColor(i) }} aria-hidden />
                  {c.category}
                </td>
                <td className="tabular py-1.5 text-right font-medium text-on-surface">{inr(c.amount)}</td>
                <td className="tabular py-1.5 text-right text-secondary">{c.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tail.length ? <p className="mt-2 text-[11px] text-secondary">The donut groups the smallest categories as “Everything else”.</p> : null}
      </div>
    </div>
  );
}

/* ---------- 6-month trend ---------- */

export type TrendPoint = { month: string; label: string; spent: number };

export function TrendChart({ data, budget, partialLabel }: { data: TrendPoint[]; budget: number; partialLabel: string }) {
  const reduce = useReducedMotion();
  const rows = data.map((d) => ({ ...d, name: d.label === partialLabel ? `${d.label}*` : d.label }));
  const max = Math.max(budget, ...data.map((d) => d.spent), 1);
  return (
    <div>
      <motion.div
        className="h-52 w-full"
        initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} />
            <YAxis
              tick={{ fill: MUTED, fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, Math.ceil((max * 1.1) / 10_000) * 10_000]}
              tickFormatter={inrCompact}
            />
            {budget > 0 ? (
              <ReferenceLine y={budget} stroke={MUTED} strokeWidth={1} label={{ value: `Budget ${inrCompact(budget)}`, position: "insideBottomLeft", fill: MUTED, fontSize: 13 }} />
            ) : null}
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [inr(Number(v)), "Spent"]} cursor={{ stroke: "var(--outline)", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="spent"
              name="Monthly spend"
              stroke="var(--chart-current)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--chart-current)", stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--chart-current)", stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
      <p className="mt-2 border-t border-surface-container-low pt-2 text-xs text-secondary">*{partialLabel} is month to date.</p>
    </div>
  );
}

export function TrendTable({ data, budget }: { data: TrendPoint[]; budget: number }) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Monthly spend for the last six months</caption>
      <thead>
        <tr className="border-b border-outline-variant text-secondary">
          <th className="pb-1.5 text-left font-medium">Month</th>
          <th className="pb-1.5 text-right font-medium">Spent</th>
          <th className="pb-1.5 text-right font-medium">Vs budget ({inr(budget)})</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-container-low">
        {data.map((d) => (
          <tr key={d.month}>
            <td className="py-1.5 text-on-surface">{d.label}</td>
            <td className="tabular py-1.5 text-right font-medium text-on-surface">{inr(d.spent)}</td>
            <td className="tabular py-1.5 text-right text-secondary">{budget > 0 ? `${d.spent <= budget ? "" : "+"}${inr(d.spent - budget)}` : "No budget"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Future You projection ---------- */

export type PathPoint = { month: number; current: number; chosen: number };

type LabelProps = { x?: number | string; y?: number | string; index?: number };

/** Draws a value label only on the final point of a line. */
function endLabel(count: number, text: string, color: string, dy: number) {
  const Label = ({ x, y, index }: LabelProps) =>
    index === count - 1 && x !== undefined && y !== undefined ? (
      <text x={Number(x) - 6} y={Number(y) + dy} textAnchor="end" fontSize={14} fontWeight={800} fill={color}>
        {text}
      </text>
    ) : null;
  Label.displayName = "EndLabel";
  return Label;
}

export function ProjectionChart({ data, years, marks = [] }: { data: PathPoint[]; years: number; marks?: { label: string; value: number }[] }) {
  const last = data[data.length - 1];
  const top = Math.max(last?.current ?? 0, last?.chosen ?? 0, 1);
  const ticks = Array.from({ length: years + 1 }, (_, i) => i * 12);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            type="number"
            domain={[0, years * 12]}
            ticks={ticks}
            tickFormatter={(m) => `Year ${m / 12}`}
            tick={{ fill: MUTED, fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
          />
          <YAxis
            tick={{ fill: MUTED, fontSize: 13 }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[0, niceCeil(top)]}
            tickFormatter={inrCompact}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(m) => `Month ${m} (Year ${(Number(m) / 12).toFixed(1)})`}
            formatter={(v, name) => [inr(Number(v)), String(name)]}
            cursor={{ stroke: "var(--outline)", strokeWidth: 1 }}
          />
          {marks
            // Lines below ~10% of the axis would crowd the baseline and their labels would overlap.
            .filter((m) => m.value >= niceCeil(top) * 0.1 && m.value <= niceCeil(top))
            .map((m) => (
              <ReferenceLine key={m.label} y={m.value} stroke={MUTED} strokeWidth={1} strokeOpacity={0.7} label={{ value: m.label, position: "insideTopLeft", fill: MUTED, fontSize: 12 }} />
            ))}
          <Legend verticalAlign="top" height={28} iconType="plainline" formatter={(v) => <span style={{ color: INK, fontSize: 14 }}>{v}</span>} />
          <Line type="monotone" dataKey="current" name="Current path" stroke="var(--chart-current)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} label={endLabel(data.length, inrCompact(last?.current ?? 0), "var(--chart-current)", 16)} />
          <Line type="monotone" dataKey="chosen" name="Chosen path" stroke="var(--chart-future)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} label={endLabel(data.length, inrCompact(last?.chosen ?? 0), "var(--chart-future)", -8)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectionTable({ data, years }: { data: PathPoint[]; years: number }) {
  const rows = Array.from({ length: years + 1 }, (_, i) => data[i * 12]).filter(Boolean);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Projected balance at the end of each year</caption>
      <thead>
        <tr className="border-b border-outline-variant text-xs text-secondary">
          <th className="pb-2 text-left font-medium">When</th>
          <th className="pb-2 text-right font-medium">Current path</th>
          <th className="pb-2 text-right font-medium">Chosen path</th>
          <th className="pb-2 text-right font-medium">Difference</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-container-low">
        {rows.map((r) => (
          <tr key={r.month}>
            <td className="py-2 text-on-surface">{r.month === 0 ? "Today" : `Year ${r.month / 12}`}</td>
            <td className="tabular py-2 text-right text-on-surface">{inr(r.current)}</td>
            <td className="tabular py-2 text-right text-on-surface">{inr(r.chosen)}</td>
            <td className="tabular py-2 text-right text-secondary">{inr(r.chosen - r.current)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rounds an axis maximum up to a tidy step so the top gridline is not an odd number. */
function niceCeil(n: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(n));
  const step = magnitude / 2;
  return Math.ceil((n * 1.08) / step) * step;
}
