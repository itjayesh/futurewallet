"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "@/lib/db/types";
import { preprocess } from "./audio";
import { normalizeSpoken } from "./normalize";
import { getVoiceEngine, getVoiceModel, VOICE_MODEL_IDS } from "./prefs";

export type VoiceStatus = "idle" | "recording" | "transcribing";

const MAX_SECONDS = 30;
const MIN_SAMPLES = 16_000 * 0.4;

/* ---------- the browser's own speech recognition ---------- */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Indian English handles Hinglish words in Roman letters; Hindi mode is used only when the app language is Hindi. */
const recognitionLang = (language: Language) => (language === "hi" ? "hi-IN" : "en-IN");

function recognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in the browser's address bar and try again.";
    case "no-speech":
      return "I did not hear anything. Try again, a bit closer to the microphone.";
    case "audio-capture":
      return "No microphone was found on this device.";
    case "network":
      return "The browser's speech service could not be reached. Check your internet, or switch to on-device voice in Settings.";
    default:
      return "Voice input failed. Please try again.";
  }
}

/* ---------- Whisper on this device: one shared worker, so the model loads once ---------- */

let worker: Worker | null = null;
let loadedModel: string | null = null;
let ready: Promise<void> | null = null;
const progressListeners = new Set<(percent: number) => void>();

function ensureModel(modelId: string): Promise<void> {
  if (!worker) worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  if (ready && loadedModel === modelId) return ready;
  loadedModel = modelId;
  const w = worker;
  ready = new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "progress") progressListeners.forEach((fn) => fn(m.percent));
      else if (m.type === "ready") {
        w.removeEventListener("message", onMessage);
        resolve();
      } else if (m.type === "error") {
        w.removeEventListener("message", onMessage);
        ready = null;
        loadedModel = null;
        reject(new Error(m.message));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "load", model: modelId });
  });
  return ready;
}

function transcribe(audio: Float32Array, language: string, task: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = worker!;
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type !== "result" && m.type !== "error") return;
      w.removeEventListener("message", onMessage);
      if (m.type === "result") resolve(m.text);
      else reject(new Error(m.message));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "transcribe", audio, language, task }, [audio.buffer]);
  });
}

/** Browser recording to 16 kHz mono samples, which is what Whisper expects. */
async function decode(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16_000 });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return new Float32Array(decoded.getChannelData(0));
  } finally {
    void ctx.close();
  }
}

function micError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") return "Microphone access is blocked. Allow it in the browser's address bar and try again.";
    if (e.name === "NotFoundError") return "No microphone was found on this device.";
    if (e.name === "NotReadableError") return "The microphone is being used by another app.";
  }
  return e instanceof Error ? e.message : "Voice input failed. Please try again.";
}

const canRecord = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" && typeof Worker !== "undefined";

/**
 * Speak, get text. Uses the browser's speech recognition when that engine is chosen and available,
 * otherwise Whisper on this device. Hindi words in Devanagari are turned into Roman Hinglish for the parser.
 */
export function useVoiceInput(language: Language, onText: (text: string) => void, onInterim?: (text: string) => void) {
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => canRecord() || recognitionCtor() !== null,
    () => false,
  );
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [percent, setPercent] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<"browser" | "device" | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTextRef = useRef(onText);
  const onInterimRef = useRef(onInterim);
  useEffect(() => {
    onTextRef.current = onText;
    onInterimRef.current = onInterim;
  });

  useEffect(() => {
    const onProgress = (p: number) => setPercent(p);
    progressListeners.add(onProgress);
    return () => {
      progressListeners.delete(onProgress);
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      recognition.current?.abort();
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const startTimer = useCallback(
    (onLimit: () => void) => {
      setSeconds(0);
      const startedAt = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) onLimit();
      }, 250);
    },
    [],
  );

  /* --- Whisper on the device --- */

  const finishDevice = useCallback(
    async (mime: string) => {
      clearTimer();
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setStatus("transcribing");
      try {
        const samples = preprocess(await decode(new Blob(chunks.current, { type: mime })));
        if (samples.length < MIN_SAMPLES) throw new Error("I did not hear enough. Speak a little longer, a bit closer to the microphone.");
        await ensureModel(VOICE_MODEL_IDS[getVoiceModel()]);
        const english = language === "en";
        // Hindi and Hinglish are translated to English text: it reads back more reliably than Devanagari from a small model.
        const text = normalizeSpoken(await transcribe(samples, english ? "english" : "hindi", english ? "transcribe" : "translate"));
        if (!text) throw new Error("I did not catch that. Try again, a bit closer to the microphone.");
        onTextRef.current(text);
      } catch (e) {
        setError(micError(e));
      } finally {
        setStatus("idle");
        setPercent(null);
      }
    },
    [clearTimer, language],
  );

  const startDevice = useCallback(async () => {
    // Noise suppression can clip quiet consonants, so it is off; automatic gain helps quiet microphones.
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    stream.current = s;
    chunks.current = [];
    const rec = new MediaRecorder(s);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => void finishDevice(rec.mimeType);
    rec.start();
    recorder.current = rec;
    setEngineUsed("device");
    setStatus("recording");
    // Start downloading the model while the user is still talking.
    ensureModel(VOICE_MODEL_IDS[getVoiceModel()]).catch(() => undefined);
    startTimer(() => recorder.current?.state !== "inactive" && recorder.current?.stop());
  }, [finishDevice, startTimer]);

  /* --- the browser's speech recognition --- */

  const startBrowser = useCallback(
    (Ctor: RecognitionCtor) => {
      const rec = new Ctor();
      rec.lang = recognitionLang(language);
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let heard = "";
      let failed = false;
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        heard = text;
        onInterimRef.current?.(normalizeSpoken(text));
      };
      rec.onerror = (e) => {
        failed = true;
        setError(recognitionError(e.error));
      };
      rec.onend = () => {
        clearTimer();
        setStatus("idle");
        const text = normalizeSpoken(heard);
        if (text && !failed) onTextRef.current(text);
      };
      recognition.current = rec;
      setEngineUsed("browser");
      setStatus("recording");
      rec.start();
      startTimer(() => rec.stop());
    },
    [clearTimer, language, startTimer],
  );

  const stop = useCallback(() => {
    if (recognition.current) recognition.current.stop();
    else if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    recognition.current = null;
    try {
      const Browser = recognitionCtor();
      if (getVoiceEngine() === "browser" && Browser) startBrowser(Browser);
      else if (canRecord()) await startDevice();
      else throw new Error("Voice input is not supported in this browser.");
    } catch (e) {
      clearTimer();
      stream.current?.getTracks().forEach((t) => t.stop());
      setStatus("idle");
      setError(micError(e));
    }
  }, [clearTimer, startBrowser, startDevice]);

  return { supported, status, percent, seconds, error, engineUsed, start, stop, clearError: () => setError(null) };
}
