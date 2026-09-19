"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AdvisorChat from "@/components/AdvisorChat";
import { Reveal } from "@/components/motion";
import { Disclaimer } from "@/components/ui";

export default function AdvisorPage() {
  return (
    <Suspense fallback={null}>
      <Advisor />
    </Suspense>
  );
}

function Advisor() {
  // "Ask the advisor about this" links here with ?ask=..., which pre-fills the box.
  const ask = useSearchParams().get("ask") ?? undefined;
  return (
    <>
      <Reveal>
        <AdvisorChat initialAsk={ask} />
      </Reveal>
      <Disclaimer />
    </>
  );
}
