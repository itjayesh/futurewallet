"use client";

import { Download, Play, Share2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/AppShell";
import { Reveal } from "@/components/motion";
import { Button, Card, Disclaimer, ErrorState, Eyebrow, Notice, Skeleton } from "@/components/ui";
import { errorMessage, useApi } from "@/lib/client/api";
import { renderShareCard } from "@/lib/client/shareCard";
import type { Personality } from "@/lib/services/patterns";

export default function PersonalityPage() {
  const { data, error, reload } = useApi<{ name: string; personality: Personality }>("/personality");
  const { openWrapped } = useApp();
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  const { personality: p, name } = data;
  const card = { name, title: p.title, tagline: p.tagline, stats: p.stats, plan: p.plan };
  const filename = `my-money-personality-${p.id}.png`;

  async function download() {
    setBusy("download");
    setMessage(null);
    try {
      const blob = await renderShareCard(card);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ tone: "success", text: "Card saved as an image." });
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setMessage(null);
    try {
      const blob = await renderShareCard(card);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `I am a ${p.title}`, text: `${p.tagline} (FutureWallet)` });
      } else {
        setMessage({ tone: "error", text: "Sharing files is not supported on this browser. Use “Download card” instead." });
      }
    } catch (e) {
      // Closing the share sheet throws AbortError, which is not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Reveal className="lg:col-span-3" index={0}>
          <Card hero className="h-full space-y-5 p-6 sm:p-8">
            <span className="sticker bg-primary text-on-primary">My money personality</span>
            <h2 className="font-headline text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              <span className="rounded-lg border-2 border-ink bg-future px-2 text-white">{p.title}</span>
            </h2>
            <p className="text-xl text-on-surface-variant">{p.tagline}</p>
            <dl className="divide-y-2 divide-ink/15 border-y-2 border-ink/15">
              {p.stats.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm text-secondary">{s.label}</dt>
                  <dd className="tabular text-right font-headline text-lg font-extrabold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Reveal>

        <Reveal className="lg:col-span-2" index={1}>
          <Card className="h-full space-y-4">
            <Eyebrow>Your plan</Eyebrow>
            <ol className="space-y-3">
              {p.plan.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary font-headline text-sm font-extrabold text-on-primary">{i + 1}</span>
                  <span className="text-sm leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={download} disabled={busy !== null}>
                <Download className="h-4 w-4" aria-hidden />
                {busy === "download" ? "Making card…" : "Download card"}
              </Button>
              <Button variant="outline" onClick={share} disabled={busy !== null}>
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </Button>
              <Button variant="outline" onClick={openWrapped}>
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Play Wrapped
              </Button>
            </div>
            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          </Card>
        </Reveal>
      </section>

      <Card>
        <p className="text-sm text-secondary">
          How this was decided: your last 90 days of spending, checked against a fixed set of habits (late-night purchases, delivery orders, weekend spikes, subscriptions, fixed costs, saving rate). The one that fits your data most
          strongly wins{p.strength > 0 ? ` (match ${Math.round(p.strength * 100)}%)` : ", and here nothing stood out"}. Numbers come from your records, not from a guess.
        </p>
      </Card>
      <Disclaimer />
    </>
  );
}
