"use client";

import { MessagesSquare, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useApp } from "./AppShell";
import AdvisorChat from "./AdvisorChat";

/**
 * In-window advisor chat, available on every screen except the Advisor page itself.
 * The conversation is mounted on first open and kept, so it survives navigating between screens.
 */
export default function ChatDock() {
  const pathname = usePathname();
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/advisor") return null;

  return (
    <>
      {open ? null : (
        <button
          type="button"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          className="btn btn-outline fixed bottom-36 right-4 z-40 !rounded-full px-4 md:bottom-24 md:right-6"
          aria-haspopup="dialog"
        >
          <MessagesSquare className="h-5 w-5" aria-hidden />
          {t("ask_advisor")}
        </button>
      )}

      {mounted ? (
        <motion.aside
          role="dialog"
          aria-label="Advisor chat"
          aria-hidden={!open}
          className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l-2 border-ink bg-background sm:w-[26rem]"
          initial={false}
          animate={open ? { x: 0, opacity: 1, visibility: "visible" } : { x: "100%", opacity: 0, transitionEnd: { visibility: "hidden" } }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b-2 border-ink px-4">
            <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">Advisor</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close advisor chat"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <AdvisorChat variant="dock" />
          </div>
        </motion.aside>
      ) : null}
    </>
  );
}
