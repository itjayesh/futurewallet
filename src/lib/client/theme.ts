"use client";

import { useSyncExternalStore } from "react";

/** The theme lives as a class on <html>. This reads it as an external store, so components re-render when it changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function toggleTheme(): void {
  setThemePref(document.documentElement.classList.contains("dark") ? "light" : "dark");
}

/* ---------- saved preferences (theme and text size) ---------- */

export type ThemePref = "system" | "light" | "dark";
export type TextScale = "1" | "1.12" | "1.25";

const CHANGE = "fw-pref-change";
const emit = () => window.dispatchEvent(new Event(CHANGE));

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribePrefs(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    subscribePrefs,
    () => {
      const v = read("fw-theme");
      return v === "light" || v === "dark" ? v : "system";
    },
    () => "system" as ThemePref,
  );
}

/** "system" follows the device. Light and dark are remembered. */
export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem("fw-theme");
    else localStorage.setItem("fw-theme", pref);
  } catch {
    // Blocked storage only means the choice is not remembered.
  }
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  emit();
}

export function useTextScale(): TextScale {
  return useSyncExternalStore(
    subscribePrefs,
    () => {
      const v = read("fw-text");
      return v === "1.12" || v === "1.25" ? v : "1";
    },
    () => "1" as TextScale,
  );
}

export function setTextScale(scale: TextScale): void {
  try {
    localStorage.setItem("fw-text", scale);
  } catch {
    // Not remembered, but it still applies now.
  }
  document.documentElement.style.setProperty("--text-scale", scale);
  emit();
}
