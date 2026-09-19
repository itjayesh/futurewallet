"use client";

import { Check, ChevronDown, Flag, Play, LayoutDashboard, PanelLeftClose, PanelLeftOpen, LogOut, MessagesSquare, Moon, PlusCircle, Settings, Sun, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api, useApi } from "@/lib/client/api";
import { translate, type TKey } from "@/lib/client/i18n";
import { authEnabled, supabaseBrowser } from "@/lib/client/supabase";
import { toggleTheme, useDarkMode } from "@/lib/client/theme";
import ChatDock from "./ChatDock";
import WrappedModal from "./WrappedModal";
import { AnimatePresence, motion, PageTransition } from "./motion";
import type { Language } from "@/lib/db/types";
import { cx } from "./ui";

export type Persona = "friendly" | "roast" | "coach";

const PERSONA_INFO: Record<Persona, { label: string; blurb: string }> = {
  friendly: { label: "Friendly", blurb: "Warm and encouraging" },
  roast: { label: "Roast", blurb: "Playful teasing, then a real fix" },
  coach: { label: "Coach", blurb: "Direct, no jokes" },
};

type AppContextValue = {
  /** Opens the Wrapped popup from anywhere in the app. */
  openWrapped: () => void;
  persona: Persona;
  setPersona: (p: Persona) => Promise<void>;
  language: Language;
  setLanguage: (l: Language) => Promise<void>;
  /** Translates an interface string into the user's language. */
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  /** Increments when the persona changes, so pages can refresh persona-written text. */
  personaVersion: number;
};
const AppContext = createContext<AppContextValue | null>(null);
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
};

const NAV: readonly { href: string; label: TKey; short: TKey; Icon: typeof Wallet }[] = [
  { href: "/dashboard", label: "nav_dashboard", short: "short_dashboard", Icon: LayoutDashboard },
  { href: "/add", label: "nav_add", short: "short_add", Icon: PlusCircle },
  { href: "/budget", label: "nav_budget", short: "short_budget", Icon: Wallet },
  { href: "/goals", label: "nav_goals", short: "short_goals", Icon: Flag },
  { href: "/future", label: "nav_future", short: "short_future", Icon: TrendingUp },
  { href: "/advisor", label: "nav_advisor", short: "short_advisor", Icon: MessagesSquare },
];

const TITLES: Record<string, TKey> = {
  "/add": "nav_add",
  "/budget": "nav_budget",
  "/goals": "nav_goals",
  "/future": "nav_future",
  "/advisor": "nav_advisor",
  "/settings": "nav_settings",
  "/personality": "nav_personality",
};

const SIDEBAR_KEY = "fw-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();
const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
};
const subscribeSidebar = (fn: () => void) => {
  sidebarListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    sidebarListeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
/** Whether the desktop sidebar is collapsed to an icon rail. Remembered per browser. */
const useSidebarCollapsed = () => useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
const toggleSidebar = () => {
  try {
    localStorage.setItem(SIDEBAR_KEY, readCollapsed() ? "0" : "1");
  } catch {}
  sidebarListeners.forEach((fn) => fn());
};

function monthTitle() {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSidebarCollapsed();
  const profile = useApi<{ profile: { persona: Persona; language?: Language } | null; onboarded: boolean }>("/profile");
  // The saved persona, unless the user just changed it in this session.
  const [chosen, setChosen] = useState<Persona | null>(null);
  const persona: Persona = chosen ?? profile.data?.profile?.persona ?? "friendly";
  const [chosenLanguage, setChosenLanguage] = useState<Language | null>(null);
  const language: Language = chosenLanguage ?? profile.data?.profile?.language ?? "en";
  const [personaVersion, setPersonaVersion] = useState(0);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const openWrapped = useCallback(() => setWrappedOpen(true), []);

  useEffect(() => {
    if (profile.data && !profile.data.onboarded) router.replace("/onboarding");
  }, [profile.data, router]);

  const setPersona = useCallback(
    async (p: Persona) => {
      const previous = chosen;
      setChosen(p);
      try {
        await api("/profile", { method: "PUT", json: { persona: p } });
        setPersonaVersion((v) => v + 1);
      } catch {
        setChosen(previous);
      }
    },
    [chosen],
  );

  const setLanguage = useCallback(
    async (l: Language) => {
      const previous = chosenLanguage;
      setChosenLanguage(l);
      try {
        await api("/profile", { method: "PUT", json: { language: l } });
        // Text the advisor wrote earlier is in the old language, so ask pages to refresh it.
        setPersonaVersion((v) => v + 1);
      } catch {
        setChosenLanguage(previous);
      }
    },
    [chosenLanguage],
  );
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(key, language, vars), [language]);

  const value = useMemo(
    () => ({ persona, setPersona, personaVersion, openWrapped, language, setLanguage, t }),
    [persona, setPersona, personaVersion, openWrapped, language, setLanguage, t],
  );
  const title = pathname === "/dashboard" ? monthTitle() : TITLES[pathname] ? t(TITLES[pathname]) : "FutureWallet";
  const hideFab = pathname === "/add" || pathname === "/advisor";

  return (
    <AppContext.Provider value={value}>
      <Sidebar pathname={pathname} collapsed={collapsed} />
      <header className={cx("sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-ink bg-background px-4 transition-[padding] duration-200 md:pr-8", collapsed ? "md:pl-28" : "md:pl-72")}>
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate font-headline text-xl font-bold tracking-tight text-on-surface" suppressHydrationWarning>{title}</h1>
          <PersonaMenu persona={persona} onChange={setPersona} />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={openWrapped} className="btn btn-primary mr-1 h-10 px-3 sm:px-4" aria-label="Play your Wrapped">
            <Play className="h-4 w-4 fill-current" aria-hidden />
            <span className="hidden sm:inline">{t("wrapped")}</span>
          </button>
          <Link
            href="/settings"
            aria-label={t("nav_settings")}
            title={t("nav_settings")}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-container hover:text-on-surface",
              pathname === "/settings" ? "bg-surface-container text-on-surface" : "text-on-surface-variant",
            )}
          >
            <Settings className="h-5 w-5" aria-hidden />
          </Link>
          <ThemeToggle />
          <SignOut />
        </div>
      </header>
      <main className={cx("mx-auto w-full max-w-7xl space-y-6 p-4 pb-28 transition-[padding] duration-200 md:pr-8 md:pt-8 md:pb-12", collapsed ? "md:pl-28" : "md:pl-72")}><PageTransition routeKey={pathname}>{children}</PageTransition></main>
      {hideFab ? null : (
        <Link
          href="/add"
          className="btn btn-primary fixed bottom-20 right-4 z-40 !rounded-full px-5 md:bottom-8 md:right-6"
        >
          <PlusCircle className="h-5 w-5" aria-hidden />
          {t("add_expense")}
        </Link>
      )}
      <ChatDock />
      {wrappedOpen ? <WrappedModal onClose={() => setWrappedOpen(false)} /> : null}
      <MobileNav pathname={pathname} />
    </AppContext.Provider>
  );
}

function Sidebar({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const { t } = useApp();
  const link = (active: boolean) =>
    cx(
      "flex items-center rounded-xl border-2 py-2.5 transition-colors",
      collapsed ? "justify-center px-0" : "gap-3 px-3",
      active
        ? "border-ink bg-primary text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]"
        : "border-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
    );
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      className={cx(
        "fixed left-0 top-0 z-40 hidden h-screen select-none flex-col border-r-2 border-ink bg-surface-container-low p-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className={cx("mb-6 flex items-center py-3", collapsed ? "flex-col gap-3" : "justify-between gap-3 px-2")}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-primary font-headline text-base font-extrabold text-on-primary shadow-[2px_2px_0_var(--pop-shadow)]">FW</div>
          {collapsed ? null : (
            <div className="min-w-0">
              <span className="block truncate font-headline text-lg font-bold leading-tight tracking-tight text-on-surface">FutureWallet</span>
              <span className="block truncate text-xs leading-tight text-secondary">Personal Advisor</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <ToggleIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={t(label)} title={collapsed ? t(label) : undefined} className={link(active)}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {collapsed ? null : <span className={cx("truncate font-headline text-sm", active ? "font-semibold" : "font-medium")}>{t(label)}</span>}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        aria-label={t("nav_settings")}
        title={collapsed ? t("nav_settings") : undefined}
        className={link(pathname === "/settings")}
      >
        <Settings className="h-5 w-5 shrink-0" aria-hidden />
        {collapsed ? null : <span className="truncate font-headline text-sm font-medium">{t("nav_settings")}</span>}
      </Link>
    </aside>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const { t } = useApp();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t-2 border-ink bg-background px-1 md:hidden"
    >
      {NAV.map(({ href, short, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 p-1", active ? "font-bold text-on-surface" : "text-secondary")}
          >
            <span className={cx("flex h-7 w-11 items-center justify-center rounded-full border-2", active ? "border-ink bg-primary text-on-primary" : "border-transparent")}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-headline text-[11px] font-semibold">{t(short)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function PersonaMenu({ persona, onChange }: { persona: Persona; onChange: (p: Persona) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-on-surface"
      >
        <span className="h-2 w-2 rounded-full border border-ink bg-primary" aria-hidden />
        <span className="hidden sm:inline">Advisor: </span>
        {PERSONA_INFO[persona].label}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      <AnimatePresence>
      {open ? (
        <motion.ul
          role="listbox"
          aria-label="Advisor style"
          className="pop-card absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-xl bg-surface-container-lowest p-1"
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {(Object.keys(PERSONA_INFO) as Persona[]).map((p) => (
            <li key={p} role="option" aria-selected={p === persona}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (p !== persona) onChange(p);
                }}
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-container-low"
              >
                <Check className={cx("mt-0.5 h-4 w-4 shrink-0", p === persona ? "text-on-surface" : "invisible")} aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-on-surface">{PERSONA_INFO[p].label}</span>
                  <span className="block text-xs text-secondary">{PERSONA_INFO[p].blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </motion.ul>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

function SignOut() {
  const router = useRouter();
  if (!authEnabled) return null;
  return (
    <button
      type="button"
      aria-label="Sign out"
      title="Sign out"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
      }}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
    >
      <LogOut className="h-5 w-5" aria-hidden />
    </button>
  );
}

function ThemeToggle() {
  const dark = useDarkMode();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
