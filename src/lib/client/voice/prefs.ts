"use client";

import { useSyncExternalStore } from "react";

/**
 * Two ways to turn speech into text:
 *  - "browser": the browser's own speech recognition. Most accurate for Hindi, Hinglish and Indian English,
 *    and it shows words as you speak. In Chrome and Edge the audio is processed by the browser vendor's service.
 *  - "device": Whisper running on this device. Private and works offline, but small models mishear more.
 */
export type VoiceEngine = "browser" | "device";
export type VoiceModel = "tiny" | "base" | "small";

export const VOICE_MODEL_IDS: Record<VoiceModel, string> = {
  tiny: "Xenova/whisper-tiny",
  base: "Xenova/whisper-base",
  small: "Xenova/whisper-small",
};

const MODEL_KEY = "fw-voice-model";
const ENGINE_KEY = "fw-voice-engine";
const EVENT = "fw-voice-change";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered, but still used this session.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getVoiceModel(): VoiceModel {
  const v = read(MODEL_KEY);
  return v === "tiny" || v === "small" ? v : "base";
}
export const setVoiceModel = (m: VoiceModel) => write(MODEL_KEY, m);
export const useVoiceModel = (): VoiceModel => useSyncExternalStore(subscribe, getVoiceModel, () => "base" as VoiceModel);

/** Defaults to the browser engine, because it is the more accurate one. It falls back to Whisper where the browser has none. */
export function getVoiceEngine(): VoiceEngine {
  return read(ENGINE_KEY) === "device" ? "device" : "browser";
}
export const setVoiceEngine = (e: VoiceEngine) => write(ENGINE_KEY, e);
export const useVoiceEngine = (): VoiceEngine => useSyncExternalStore(subscribe, getVoiceEngine, () => "browser" as VoiceEngine);

/** Deletes the downloaded model files from the browser cache. They download again on next use. */
export async function clearVoiceModelCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete("transformers-cache");
}
