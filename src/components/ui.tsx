"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "./motion";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Card({ className, hero, ...rest }: HTMLAttributes<HTMLDivElement> & { hero?: boolean }) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-xl bg-surface-container-lowest p-5",
        hero ? "pop-card" : "border-[1.5px] border-outline-variant",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-headline text-base font-semibold text-on-surface">{children}</h2>
      {aside ? <span className="text-xs text-secondary">{aside}</span> : null}
    </div>
  );
}

/** Small uppercase label used at the top of stat cards. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="font-headline text-xs font-semibold uppercase tracking-wider text-secondary">{children}</span>;
}

type Variant = "primary" | "outline" | "text";
const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  text: "btn-text",
};

export function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cx("btn", VARIANTS[variant], className)}
      {...rest}
    />
  );
}

export const inputCls =
  "h-11 w-full rounded-lg border-2 border-ink/20 bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-secondary focus:border-ink disabled:opacity-60";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-on-surface">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-secondary">{hint}</span> : null}
    </label>
  );
}

export type Tone = "primary" | "warning" | "error" | "success" | "neutral";
const BAR: Record<Tone, string> = {
  primary: "bg-now",
  warning: "bg-warning",
  error: "bg-error",
  success: "bg-success",
  neutral: "bg-secondary",
};
export const TEXT_TONE: Record<Tone, string> = {
  primary: "text-now",
  warning: "text-warning",
  error: "text-error",
  success: "text-success",
  neutral: "text-secondary",
};

export function ProgressBar({ pct, tone = "primary", label }: { pct: number; tone?: Tone; label: string }) {
  const value = Math.max(0, Math.min(100, pct));
  const reduce = useReducedMotion();
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-surface-container"
    >
      <motion.div className={cx("h-full rounded-full", BAR[tone])} initial={reduce ? false : { width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

const NOTICE: Record<"error" | "success" | "info", { cls: string; Icon: typeof Info }> = {
  error: { cls: "border-error/30 bg-error-container text-error", Icon: AlertCircle },
  success: { cls: "border-success/30 bg-success-container text-success", Icon: CheckCircle2 },
  info: { cls: "border-outline-variant bg-surface-container-low text-on-surface-variant", Icon: Info },
};

export function Notice({ tone = "info", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const { cls, Icon } = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-surface-container", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <Notice tone="error">{message}</Notice>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function Disclaimer() {
  return <p className="pb-2 pt-6 text-center text-xs text-secondary">General guidance, not regulated financial advice.</p>;
}

/** A row of pill choices, one selected. Used for settings and for tuning a scenario. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cx(
            "rounded-full border-2 px-4 py-1.5 font-headline text-sm font-bold transition-all active:scale-95",
            o.id === value ? "border-ink bg-primary text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]" : "border-ink/25 text-on-surface-variant hover:border-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
