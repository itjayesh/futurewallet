/**
 * Cleans up recorded samples before Whisper hears them. Quiet recordings and long silences at either end
 * are two of the most common reasons it mishears or invents words.
 */

const TARGET_PEAK = 0.95;
/** Below this peak the recording is treated as silence. */
const SILENCE_PEAK = 0.005;
const FRAME = 320; // 20 ms at 16 kHz
/** A frame counts as speech when its RMS is above this share of the loudest frame. */
const SPEECH_RATIO = 0.08;
const PAD_FRAMES = 12; // keep about 240 ms around the speech so words are not clipped

export function peak(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > p) p = v;
  }
  return p;
}

/** Scales the recording so its loudest point is near full scale. Silence stays silence. */
export function normalizePeak(samples: Float32Array): Float32Array {
  const p = peak(samples);
  if (p < SILENCE_PEAK) return samples;
  const gain = TARGET_PEAK / p;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

function frameRms(samples: Float32Array, start: number): number {
  const end = Math.min(samples.length, start + FRAME);
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** Cuts leading and trailing silence, keeping a small pad. Returns an empty array when nothing was said. */
export function trimSilence(samples: Float32Array): Float32Array {
  if (peak(samples) < SILENCE_PEAK) return new Float32Array(0);
  const frames = Math.floor(samples.length / FRAME);
  if (frames === 0) return samples;
  const levels = Array.from({ length: frames }, (_, i) => frameRms(samples, i * FRAME));
  const loudest = Math.max(...levels);
  const threshold = loudest * SPEECH_RATIO;
  const first = levels.findIndex((l) => l >= threshold);
  let last = levels.length - 1;
  while (last > first && levels[last] < threshold) last--;
  const from = Math.max(0, first - PAD_FRAMES) * FRAME;
  const to = Math.min(samples.length, (last + 1 + PAD_FRAMES) * FRAME);
  return samples.slice(from, to);
}

/** Trim, then normalize. The order matters: the trim decides what counts as speech before the gain changes it. */
export function preprocess(samples: Float32Array): Float32Array {
  const trimmed = trimSilence(samples);
  return trimmed.length === 0 ? trimmed : normalizePeak(trimmed);
}
