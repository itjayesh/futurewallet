"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, Download, RotateCcw, Share2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { renderWrappedCard } from "@/lib/client/shareCard";
import { inr } from "@/lib/format";
import type { Wrapped } from "@/lib/services/wrapped";
import { CountUp } from "./motion";

/**
 * "Wrapped": this month as a deck of cards you swipe through, like Tinder.
 * Drag a card left or right (or use the arrows) and it flies off; Back brings it back.
 * All numbers come from /api/wrapped, computed from the user's own records.
 */

type Theme = { bg: string; fg: string; accent: string };
const LIME: Theme = { bg: "#c8f03c", fg: "#15130f", accent: "#ff3d8b" };
const INK: Theme = { bg: "#15130f", fg: "#f7f3ea", accent: "#c8f03c" };
const PINK: Theme = { bg: "#ff3d8b", fg: "#15130f", accent: "#f7f3ea" };
const BLUE: Theme = { bg: "#3a5bff", fg: "#ffffff", accent: "#c8f03c" };
const PAPER: Theme = { bg: "#f7f3ea", fg: "#15130f", accent: "#ff3d8b" };

const money = (n: number) => inr(n);
const whole = (n: number) => String(Math.round(n));
const EASE = [0.16, 1, 0.3, 1] as const;

type CardDef = { id: string; theme: Theme; render: (w: Wrapped, t: Theme) => ReactNode };

/** The deck. A card with no data behind it is left out. */
function buildDeck(w: Wrapped, onShare: ShareActions): CardDef[] {
  const deck: CardDef[] = [
    {
      id: "intro",
      theme: LIME,
      render: (w, t) => (
        <Stack>
          <Item><Eyebrow t={t}>FutureWallet Wrapped</Eyebrow></Item>
          <Item><Headline>{w.name ? `${w.name}, this` : "This"} was your {w.monthName}.</Headline></Item>
          <Item><p className="max-w-[16rem] text-lg font-medium">Swipe a card to see how your money moved.</p></Item>
        </Stack>
      ),
    },
    {
      id: "total",
      theme: INK,
      render: (w, t) => (
        <Stack>
          <Item><Eyebrow t={t}>You spent</Eyebrow></Item>
          <Item>
            <p className="font-headline text-[clamp(3rem,15vw,5rem)] font-extrabold leading-none tracking-tight" style={{ color: t.accent }}>
              <CountUp value={w.total} format={money} duration={1.1} />
            </p>
          </Item>
          <Item><p className="text-lg">across {w.txCount} transactions, about {inr(w.perDay)} a day.</p></Item>
          {w.vsLastMonthPct !== null ? (
            <Item>
              <Sticker bg={t.accent} fg="#15130f">
                {w.vsLastMonthPct === 0 ? "Same as" : `${Math.abs(w.vsLastMonthPct)}% ${w.vsLastMonthPct < 0 ? "less" : "more"} than`} the same days last month
              </Sticker>
            </Item>
          ) : null}
        </Stack>
      ),
    },
    {
      id: "categories",
      theme: PINK,
      render: (w, t) => {
        const max = Math.max(...w.topCategories.map((c) => c.amount), 1);
        return (
          <Stack>
            <Item><Eyebrow t={t}>Where it went</Eyebrow></Item>
            <Item><Headline>Your top 3.</Headline></Item>
            <div className="mt-2 space-y-4">
              {w.topCategories.map((c, i) => (
                <Item key={c.category}>
                  <div className="flex items-baseline justify-between gap-3 font-headline font-bold">
                    <span className="text-xl">{c.category}</span>
                    <span className="tabular text-lg">{inr(c.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-4 overflow-hidden rounded-full border-2" style={{ borderColor: t.fg }}>
                    <motion.div
                      className="h-full"
                      style={{ background: t.fg }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.amount / max) * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.35 + i * 0.12, ease: EASE }}
                    />
                  </div>
                  <p className="mt-0.5 text-sm font-medium">{c.sharePct}% of everything you spent</p>
                </Item>
              ))}
            </div>
          </Stack>
        );
      },
    },
  ];

  if (w.topMerchant) {
    deck.push({
      id: "merchant",
      theme: BLUE,
      render: (w, t) => (
        <Stack>
          <Item><Eyebrow t={t}>Your number one merchant</Eyebrow></Item>
          <Item><Headline>{w.topMerchant!.merchant}</Headline></Item>
          <Item><p className="text-xl font-semibold">{inr(w.topMerchant!.amount)} across {w.topMerchant!.count} {w.topMerchant!.count === 1 ? "purchase" : "purchases"}.</p></Item>
          {w.delivery ? (
            <Item>
              <Sticker bg={t.accent} fg="#15130f">
                Food delivery: {w.delivery.orders} orders, {inr(w.delivery.spend)}
              </Sticker>
            </Item>
          ) : null}
        </Stack>
      ),
    });
  }

  if (w.lateNight) {
    deck.push({
      id: "late",
      theme: INK,
      render: (w, t) => (
        <Stack>
          <Item><Eyebrow t={t}>After 11 pm</Eyebrow></Item>
          <Item><Headline>The night owl in your wallet.</Headline></Item>
          <Item><Dial accent={PINK.bg} fg={t.fg} /></Item>
          <Item>
            <p className="text-lg">
              <strong style={{ color: t.accent }}>{w.lateNight!.sharePct}%</strong> of your fun money went after 11 pm: {inr(w.lateNight!.spend)}, {w.lateNight!.count} times.
            </p>
          </Item>
        </Stack>
      ),
    });
  }

  if (w.busiestDay) {
    deck.push({
      id: "weekday",
      theme: PAPER,
      render: (w, t) => {
        const max = Math.max(...w.weekday.map((d) => d.amount), 1);
        return (
          <Stack>
            <Item><Eyebrow t={t}>Your day of the week</Eyebrow></Item>
            <Item><Headline>{w.busiestDay!.name} is your day.</Headline></Item>
            <div className="mt-3 flex h-40 items-end gap-2">
              {w.weekday.map((d, i) => {
                const top = d.name === w.busiestDay!.name;
                return (
                  <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <motion.div
                      className="w-full rounded-md border-2"
                      style={{ borderColor: t.fg, background: top ? "#c8f03c" : "transparent" }}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(6, (d.amount / max) * 128) }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.06, ease: EASE }}
                    />
                    <span className="text-xs font-bold">{d.label}</span>
                  </div>
                );
              })}
            </div>
            <Item><p className="text-lg">{inr(w.busiestDay!.amount)} on {w.busiestDay!.name}s this month.</p></Item>
          </Stack>
        );
      },
    });
  }

  if (w.biggest) {
    deck.push({
      id: "biggest",
      theme: LIME,
      render: (w, t) => (
        <Stack>
          <Item><Eyebrow t={t}>Your biggest splurge</Eyebrow></Item>
          <Item>
            <p className="font-headline text-[clamp(3rem,15vw,5rem)] font-extrabold leading-none tracking-tight">
              <CountUp value={w.biggest!.amount} format={money} duration={0.9} />
            </p>
          </Item>
          <Item><p className="text-xl font-semibold">at {w.biggest!.merchant}, on {shortDate(w.biggest!.date)}.</p></Item>
          <Item><Sticker bg={t.accent} fg="#fff">{w.biggest!.category}</Sticker></Item>
        </Stack>
      ),
    });
  }

  deck.push({
    id: "nospend",
    theme: BLUE,
    render: (w, t) => (
      <Stack>
        <Item><Eyebrow t={t}>No-spend days</Eyebrow></Item>
        <Item>
          <p className="font-headline text-[clamp(3rem,15vw,5rem)] font-extrabold leading-none tracking-tight" style={{ color: t.accent }}>
            <CountUp value={w.noSpend.days} format={whole} duration={0.8} />
          </p>
        </Item>
        <Item><p className="text-lg">Longest streak: {w.noSpend.longestStreak} {w.noSpend.longestStreak === 1 ? "day" : "days"} without a fun purchase.</p></Item>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {w.noSpend.calendar.map((c, i) => (
            <motion.span
              key={c.day}
              className="aspect-square rounded-full border-2"
              style={{ borderColor: t.fg, background: c.spent ? "transparent" : t.accent }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.02, type: "spring", stiffness: 500, damping: 22 }}
              title={`${c.day}: ${c.spent ? "spent" : "no-spend day"}`}
            />
          ))}
        </div>
        <p className="text-xs font-medium">Filled = a day with no fun spending.</p>
      </Stack>
    ),
  });

  deck.push({
    id: "personality",
    theme: INK,
    render: (w, t) => (
      <Stack>
        <Item><Eyebrow t={t}>Which means you are</Eyebrow></Item>
        <motion.h2
          className="font-headline text-[clamp(2.6rem,12vw,4.2rem)] font-extrabold leading-[1] tracking-tight"
          initial={{ scale: 2.2, rotate: -14, opacity: 0 }}
          animate={{ scale: 1, rotate: -2, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.25 }}
        >
          <span className="rounded-lg border-2 px-2 text-white" style={{ background: PINK.bg, borderColor: t.fg }}>{w.personality.title}</span>
        </motion.h2>
        <Item><p className="text-lg">{w.personality.tagline}</p></Item>
        <Item>
          <dl className="divide-y" style={{ borderColor: "rgba(247,243,234,.25)" }}>
            {w.personality.stats.map((s) => (
              <div key={s.label} className="flex justify-between gap-3 py-2 text-sm" style={{ borderColor: "rgba(247,243,234,.25)" }}>
                <dt className="opacity-75">{s.label}</dt>
                <dd className="text-right font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Item>
      </Stack>
    ),
  });

  deck.push({
    id: "future",
    theme: PAPER,
    render: (w, t) => {
      const max = Math.max(w.future.chosen, w.future.current, 1);
      return (
        <Stack>
          <Item><Eyebrow t={t}>One small move</Eyebrow></Item>
          <Item><Headline>Put away {inr(w.future.monthlySaving)} a month.</Headline></Item>
          <div className="mt-2 space-y-3">
            {[
              { label: "Where you are headed", value: w.future.current, color: BLUE.bg },
              { label: `With ${inr(w.future.monthlySaving)} a month`, value: w.future.chosen, color: PINK.bg },
            ].map((b, i) => (
              <Item key={b.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
                  <span>{b.label}</span>
                  <span className="tabular font-headline text-lg"><CountUp value={b.value} format={money} duration={1.1} /></span>
                </div>
                <div className="mt-1 h-5 overflow-hidden rounded-full border-2" style={{ borderColor: t.fg }}>
                  <motion.div className="h-full" style={{ background: b.color }} initial={{ width: 0 }} animate={{ width: `${(b.value / max) * 100}%` }} transition={{ duration: 1, delay: 0.4 + i * 0.25, ease: EASE }} />
                </div>
              </Item>
            ))}
          </div>
          <Item><Sticker bg={PINK.bg} fg="#15130f">+{inr(w.future.difference)} in {w.future.years} years</Sticker></Item>
          <p className="text-xs opacity-70">Assumes a 7% annual return. An assumption, not a promise.</p>
        </Stack>
      );
    },
  });

  deck.push({
    id: "outro",
    theme: PINK,
    render: (w, t) => (
      <Stack>
        <Item><Eyebrow t={t}>That was</Eyebrow></Item>
        <Item><Headline>Your {w.monthName}, wrapped.</Headline></Item>
        <Item>
          <div className="flex flex-wrap gap-3">
            <PopButton onClick={onShare.download} bg="#c8f03c"><Download className="h-4 w-4" aria-hidden />Download card</PopButton>
            <PopButton onClick={onShare.share} bg="#f7f3ea"><Share2 className="h-4 w-4" aria-hidden />Share</PopButton>
          </div>
        </Item>
        {onShare.message ? <p className="text-sm font-semibold">{onShare.message}</p> : null}
        <p className="text-sm font-medium">Swipe back to replay any card.</p>
      </Stack>
    ),
  });

  void w;
  return deck;
}

type ShareActions = { download: () => void; share: () => void; message: string | null };

/* ---------- the popup ---------- */

export default function WrappedModal({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<Wrapped | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  // The parent mounts this only while open, so every opening starts fresh from the first card.
  useEffect(() => {
    let cancelled = false;
    api<{ wrapped: Wrapped }>("/wrapped")
      .then((r) => !cancelled && (setData(r.wrapped), setError(null)))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const shareActions: ShareActions = useMemo(() => {
    const make = async () => {
      if (!data) throw new Error("Not ready yet.");
      return renderWrappedCard(data);
    };
    return {
      message,
      download: async () => {
        try {
          const blob = await make();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `my-${data?.monthName.toLowerCase()}-wrapped.png`;
          a.click();
          URL.revokeObjectURL(url);
          setMessage("Saved as an image.");
        } catch (e) {
          setMessage(errorMessage(e));
        }
      },
      share: async () => {
        try {
          const file = new File([await make()], "my-wrapped.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `My ${data?.monthName} Wrapped` });
          else setMessage("Sharing files is not supported here. Use Download card.");
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) setMessage(errorMessage(e));
        }
      },
    };
  }, [data, message]);

  const deck = useMemo(() => (data ? buildDeck(data, shareActions) : []), [data, shareActions]);
  const last = deck.length - 1;

  const go = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      setIndex((i) => Math.max(0, Math.min(last, i + d)));
    },
    [last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const behind = deck.slice(index + 1, index + 3);
  const current = deck[index];

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#15130f]/85 p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Your Wrapped" tabIndex={-1} className="relative flex w-full max-w-[26rem] flex-col items-center gap-4 outline-none">
        <div className="flex w-full items-center justify-between text-[#f7f3ea]">
          <div className="flex flex-1 gap-1" aria-hidden>
            {deck.map((c, i) => (
              <span key={c.id} className="h-1 flex-1 rounded-full" style={{ background: i <= index ? "#c8f03c" : "rgba(247,243,234,.3)" }} />
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close Wrapped" className="ml-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#f7f3ea]/60 hover:border-[#f7f3ea]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative h-[min(72dvh,38rem)] w-full">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[#15130f] bg-[#f7f3ea] p-6 text-center text-[#15130f]">
              <p className="font-headline text-xl font-bold">Could not load your Wrapped</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : !data ? (
            <div className="flex h-full items-center justify-center rounded-2xl border-2 border-[#15130f] bg-[#c8f03c] text-[#15130f]">
              <p className="font-headline text-2xl font-extrabold">Wrapping your month…</p>
            </div>
          ) : (
            <>
              {[...behind].reverse().map((c, i) => {
                const depth = behind.length - i; // 2 furthest, 1 nearest
                return (
                  <div
                    key={c.id}
                    aria-hidden
                    className="absolute inset-0 rounded-2xl border-2 border-[#15130f]"
                    style={{ background: c.theme.bg, transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`, zIndex: 10 - depth }}
                  />
                );
              })}
              <AnimatePresence custom={dir} initial={false}>
                {current ? (
                  <TopCard key={current.id} theme={current.theme} dir={dir} reduce={!!reduce} onDismiss={go} canGoNext={index < last} canGoBack={index > 0}>
                    {current.render(data, current.theme)}
                  </TopCard>
                ) : null}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-[#f7f3ea]">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous card" className="flex h-11 items-center gap-1 rounded-full border-2 border-[#f7f3ea]/60 px-4 font-headline text-sm font-bold hover:border-[#f7f3ea] disabled:opacity-30">
            {index === last ? <RotateCcw className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
            Back
          </button>
          <span className="tabular min-w-[3.5rem] text-center text-sm font-semibold" aria-live="polite">
            {deck.length ? `${index + 1} / ${deck.length}` : ""}
          </span>
          <button type="button" onClick={() => go(1)} disabled={index >= last} aria-label="Next card" className="flex h-11 items-center gap-1 rounded-full border-2 border-[#15130f] bg-[#c8f03c] px-4 font-headline text-sm font-bold text-[#15130f] shadow-[3px_3px_0_rgba(247,243,234,.35)] disabled:opacity-30">
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="text-xs text-[#f7f3ea]/70">Swipe the card left or right, or use the arrow keys.</p>
      </div>
    </motion.div>
  );
}

/** The card on top: drag it sideways and let go past a threshold, and it flies off. */
function TopCard({
  children,
  theme,
  dir,
  reduce,
  onDismiss,
  canGoNext,
  canGoBack,
}: {
  children: ReactNode;
  theme: Theme;
  dir: 1 | -1;
  reduce: boolean;
  onDismiss: (d: 1 | -1) => void;
  canGoNext: boolean;
  canGoBack: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16]);

  function end(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const power = Math.abs(info.offset.x) + Math.abs(info.velocity.x) * 0.15;
    // Swiping left moves forward, swiping right goes back, the way a deck of cards reads.
    const d: 1 | -1 = info.offset.x < 0 ? 1 : -1;
    const allowed = d === 1 ? canGoNext : canGoBack;
    if (power > 150 && allowed) onDismiss(d);
    else animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
  }

  return (
    <motion.div
      className="absolute inset-0 z-20 cursor-grab touch-pan-y select-none overflow-hidden rounded-2xl border-2 border-[#15130f] p-6 shadow-[5px_5px_0_rgba(0,0,0,.45)] active:cursor-grabbing sm:p-7"
      style={{ x, rotate, background: theme.bg, color: theme.fg }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={end}
      custom={dir}
      variants={{
        exit: (d: number) => ({ x: d * -560, rotate: d * -22, opacity: 0, transition: { duration: reduce ? 0.01 : 0.28, ease: "easeIn" } }),
      }}
      initial={reduce ? false : { scale: 0.94, y: 14, opacity: 0.6 }}
      animate={{ scale: 1, y: 0, opacity: 1, transition: { duration: 0.25 } }}
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

/* ---------- small building blocks ---------- */

function Stack({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex h-full flex-col justify-center gap-4"
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.11, delayChildren: 0.12 } } }}
    >
      {children}
    </motion.div>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>{children}</motion.div>
  );
}

function Eyebrow({ children, t }: { children: ReactNode; t: Theme }) {
  return (
    <span className="inline-block rounded-md border-2 px-2 py-0.5 font-headline text-xs font-extrabold uppercase tracking-wider" style={{ borderColor: t.fg }}>
      {children}
    </span>
  );
}

function Headline({ children }: { children: ReactNode }) {
  return <h2 className="font-headline text-[clamp(2.2rem,10vw,3.4rem)] font-extrabold leading-[0.98] tracking-tight">{children}</h2>;
}

function Sticker({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span className="inline-block -rotate-2 rounded-lg border-2 border-[#15130f] px-2.5 py-1 text-sm font-extrabold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function PopButton({ children, bg, onClick }: { children: ReactNode; bg: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-[#15130f] px-4 font-headline text-sm font-bold text-[#15130f] shadow-[3px_3px_0_#15130f] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      style={{ background: bg }}
    >
      {children}
    </button>
  );
}

/** 24 hour dial with the 11 pm hour marked. */
function Dial({ accent, fg }: { accent: string; fg: string }) {
  const cx = 60, cy = 60, r = 46;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40" role="img" aria-label="A 24 hour clock with the hour after 11 pm highlighted">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={fg} strokeOpacity={0.25} strokeWidth={14} />
      {Array.from({ length: 24 }, (_, h) => {
        const a1 = ((h / 24) * 360 - 90) * (Math.PI / 180);
        const a2 = (((h + 0.86) / 24) * 360 - 90) * (Math.PI / 180);
        const hot = h === 23;
        return (
          <motion.path
            key={h}
            d={`M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`}
            fill="none"
            stroke={hot ? accent : fg}
            strokeOpacity={hot ? 1 : 0.55}
            strokeWidth={hot ? 16 : 12}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3 + h * 0.03, duration: 0.3 }}
          />
        );
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill={fg}>11 pm</text>
    </svg>
  );
}

function shortDate(iso: string): string {
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${M[m - 1]}`;
}
