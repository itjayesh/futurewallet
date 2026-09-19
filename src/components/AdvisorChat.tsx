"use client";

import { Check, Flame, Loader2, Send, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { motion, useReducedMotion } from "./motion";
import RichText from "./RichText";
import { Button, cx, inputCls } from "./ui";

type Step = { id: string; label: string; status: "running" | "done" | "error" };
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: Step[];
  confirm?: { actionId: string; summary: string; state: "pending" | "working" | "done" | "cancelled" | "error"; message?: string };
  undo?: { expenseId: string; label: string; state: "available" | "undone" };
  sources?: { label: string; value: string }[];
  streaming?: boolean;
  error?: string;
};

type AgentEvent =
  | { type: "step"; id: string; tool: string; label: string; status: Step["status"] }
  | { type: "token"; text: string }
  | { type: "confirm"; actionId: string; summary: string }
  | { type: "undo"; expenseId: string; label: string }
  | { type: "sources"; facts: { label: string; value: string }[] }
  | { type: "error"; message: string }
  | { type: "done" }
  | { type: "mood" | "ui"; [k: string]: unknown };

const QUICK = ["Where can I save?", "Summarize this month", "When can I afford a bike?"];
const ROAST_PROMPT = "Roast my wallet: tease what I did with money this month, then give me one real fix.";

let counter = 0;
const uid = () => `m${Date.now()}-${counter++}`;

export default function AdvisorChat({ variant = "page", initialAsk }: { variant?: "page" | "dock"; initialAsk?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialAsk ?? "");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Saved conversation.
  useEffect(() => {
    api<{ messages: { id: string; role: "user" | "assistant"; content: string }[] }>("/chat")
      .then((r) => setMessages(r.messages.map((m) => ({ id: m.id, role: m.role, text: m.content, steps: [] }))))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  const patch = useCallback((id: string, fn: (m: Msg) => Msg) => setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m))), []);

  const send = useCallback(
    async (text: string, persona?: "roast") => {
      const message = text.trim();
      if (!message || busy) return;
      const aid = uid();
      setBusy(true);
      setInput("");
      setMessages((all) => [
        ...all,
        { id: uid(), role: "user", text: message, steps: [] },
        { id: aid, role: "assistant", text: "", steps: [], streaming: true },
      ]);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, ...(persona ? { persona } : {}) }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "The advisor could not answer. Please try again.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            if (!chunk.startsWith("data: ")) continue;
            const ev = JSON.parse(chunk.slice(6)) as AgentEvent;
            if (ev.type === "token") patch(aid, (m) => ({ ...m, text: m.text + ev.text }));
            else if (ev.type === "step")
              patch(aid, (m) => ({
                ...m,
                steps: m.steps.some((s) => s.id === ev.id)
                  ? m.steps.map((s) => (s.id === ev.id ? { ...s, label: ev.label, status: ev.status } : s))
                  : [...m.steps, { id: ev.id, label: ev.label, status: ev.status }],
              }));
            else if (ev.type === "confirm") patch(aid, (m) => ({ ...m, confirm: { actionId: ev.actionId, summary: ev.summary, state: "pending" } }));
            else if (ev.type === "undo") patch(aid, (m) => ({ ...m, undo: { expenseId: ev.expenseId, label: ev.label, state: "available" } }));
            else if (ev.type === "sources") patch(aid, (m) => ({ ...m, sources: ev.facts }));
            else if (ev.type === "error") patch(aid, (m) => ({ ...m, error: ev.message }));
          }
        }
      } catch (e) {
        patch(aid, (m) => ({ ...m, error: errorMessage(e) }));
      } finally {
        patch(aid, (m) => ({ ...m, streaming: false }));
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, patch],
  );

  async function decide(msg: Msg, decision: "confirm" | "cancel") {
    if (!msg.confirm) return;
    patch(msg.id, (m) => ({ ...m, confirm: m.confirm && { ...m.confirm, state: "working" } }));
    try {
      const r = await api<{ message: string }>("/agent/confirm", { json: { actionId: msg.confirm.actionId, decision } });
      patch(msg.id, (m) => ({ ...m, confirm: m.confirm && { ...m.confirm, state: decision === "confirm" ? "done" : "cancelled", message: r.message } }));
    } catch (e) {
      patch(msg.id, (m) => ({ ...m, confirm: m.confirm && { ...m.confirm, state: "error", message: errorMessage(e) } }));
    }
  }

  async function undo(msg: Msg) {
    if (!msg.undo) return;
    try {
      await api(`/expenses/${msg.undo.expenseId}`, { method: "DELETE" });
      patch(msg.id, (m) => ({ ...m, undo: m.undo && { ...m.undo, state: "undone" } }));
    } catch {
      // Already gone or unreachable; leave the button so the user can retry.
    }
  }

  const empty = loaded && messages.length === 0;

  return (
    <div className={cx("flex min-h-0 flex-col", variant === "page" ? "pop-card h-[calc(100dvh-13rem)] min-h-[28rem] rounded-xl bg-surface-container-lowest" : "h-full")}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-label="Conversation">
        {empty ? (
          <p className="mx-auto max-w-sm pt-8 text-center text-sm text-secondary">
            Ask about your spending, budget or goals. You can also just say what you spent, like “kal Zomato pe 450 diye”.
          </p>
        ) : null}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} onDecide={(d) => decide(m, d)} onUndo={() => undo(m)} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t-2 border-ink p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send(ROAST_PROMPT, "roast")}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-primary px-3 py-1 text-xs font-bold text-on-primary shadow-[2px_2px_0_var(--pop-shadow)] transition-transform hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            Roast my wallet
          </button>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send(q)}
              className="rounded-full border-2 border-ink/25 bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface transition-colors hover:border-ink disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            className={inputCls}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending, budget or goals"
            maxLength={1000}
            aria-label="Message"
          />
          <Button type="submit" disabled={busy || !input.trim()} className="shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            Send
          </Button>
        </form>
        <p className="mt-2 text-xs text-secondary">Answers use only your own data.</p>
      </div>
    </div>
  );
}

function Bubble({ m, onDecide, onUndo }: { m: Msg; onDecide: (d: "confirm" | "cancel") => void; onUndo: () => void }) {
  const reduce = useReducedMotion();
  const enter = reduce ? {} : { initial: { opacity: 0, y: 10, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.22 } };
  if (m.role === "user") {
    return (
      <motion.div className="flex justify-end" {...enter}>
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-on-surface px-3.5 py-2.5 text-sm text-background">{m.text}</p>
      </motion.div>
    );
  }
  return (
    <motion.div className="max-w-[92%] space-y-2" {...enter}>
      <span className="font-headline text-[11px] font-bold uppercase tracking-wider text-secondary">Advisor</span>
      {m.steps.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {m.steps.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/25 bg-surface-container-low px-2.5 py-0.5 text-xs font-medium text-on-surface">
              {s.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className={cx("h-3 w-3", s.status === "error" && "text-error")} aria-hidden />}
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      {m.text || m.streaming ? (
        <div className="rounded-xl rounded-bl-sm border-2 border-ink bg-surface-container-lowest px-3.5 py-2.5 text-sm leading-relaxed text-on-surface">
          {m.text ? <RichText text={m.text} /> : <span className="text-secondary">Thinking…</span>}
        </div>
      ) : null}

      {m.undo ? (
        <p className="flex items-center gap-2 text-xs text-secondary">
          {m.undo.state === "undone" ? "Removed." : m.undo.label}
          {m.undo.state === "available" ? (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 font-semibold text-on-surface underline underline-offset-2">
              <Undo2 className="h-3 w-3" aria-hidden />
              Undo
            </button>
          ) : null}
        </p>
      ) : null}

      {m.confirm ? (
        <div className="rounded-xl border-2 border-ink bg-surface-container-lowest p-3">
          <p className="text-sm text-on-surface">{m.confirm.summary}</p>
          {m.confirm.state === "pending" || m.confirm.state === "working" ? (
            <div className="mt-3 flex gap-2">
              <Button className="h-9" disabled={m.confirm.state === "working"} onClick={() => onDecide("confirm")}>
                Confirm
              </Button>
              <Button variant="outline" className="h-9" disabled={m.confirm.state === "working"} onClick={() => onDecide("cancel")}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className={cx("mt-2 text-xs font-semibold", m.confirm.state === "error" ? "text-error" : "text-success")}>{m.confirm.message}</p>
          )}
        </div>
      ) : null}

      {m.sources && m.sources.length > 0 ? (
        <details className="text-xs text-secondary">
          <summary className="cursor-pointer select-none font-medium">Based on</summary>
          <ul className="mt-1 space-y-0.5">
            {m.sources.map((s, i) => (
              <li key={i}>
                {s.label}: <span className="tabular font-medium text-on-surface">{s.value}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {m.error ? <p className="text-xs font-medium text-error">{m.error}</p> : null}
    </motion.div>
  );
}
