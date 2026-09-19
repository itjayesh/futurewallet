/// <reference lib="webworker" />
// Runs Whisper in a Web Worker so the page stays responsive. The model is downloaded once from
// Hugging Face, cached by the browser, and everything after that runs on the device.
import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

type Recognizer = (audio: Float32Array, options: { language: string; task: string; chunk_length_s: number }) => Promise<{ text: string } | { text: string }[]>;

const post = (message: unknown) => (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);

let recognizer: Recognizer | null = null;
const files = new Map<string, { loaded: number; total: number }>();

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as
    | { type: "load"; model: string }
    | { type: "transcribe"; audio: Float32Array; language: string; task: string };

  if (msg.type === "load") {
    try {
      files.clear();
      recognizer = (await pipeline("automatic-speech-recognition", msg.model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status !== "progress" || !p.file || !p.total) return;
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            total += f.total;
          }
          post({ type: "progress", percent: total ? Math.min(99, Math.round((loaded / total) * 100)) : 0 });
        },
      })) as unknown as Recognizer;
      post({ type: "ready" });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (msg.type === "transcribe") {
    try {
      if (!recognizer) throw new Error("The voice model is not loaded yet.");
      const out = await recognizer(msg.audio, { language: msg.language, task: msg.task, chunk_length_s: 30 });
      const text = (Array.isArray(out) ? out[0]?.text : out.text) ?? "";
      post({ type: "result", text: text.trim() });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
};
