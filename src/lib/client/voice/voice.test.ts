import { describe, expect, it } from "vitest";
import { normalizePeak, peak, preprocess, trimSilence } from "./audio";
import { normalizeSpoken } from "./normalize";

const tone = (seconds: number, amplitude: number) => Float32Array.from({ length: Math.round(seconds * 16000) }, (_, i) => Math.sin(i / 8) * amplitude);
const silence = (seconds: number) => new Float32Array(Math.round(seconds * 16000));
const join = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

describe("normalizePeak", () => {
  it("brings a quiet recording up to near full scale", () => {
    const quiet = tone(1, 0.05);
    expect(peak(normalizePeak(quiet))).toBeCloseTo(0.95, 2);
  });
  it("leaves silence alone instead of amplifying noise", () => {
    const hiss = tone(1, 0.001);
    expect(peak(normalizePeak(hiss))).toBeCloseTo(0.001, 3);
  });
});

describe("trimSilence", () => {
  it("cuts long silence around speech but keeps a little padding", () => {
    const clip = join(silence(2), tone(1, 0.5), silence(2));
    const trimmed = trimSilence(clip);
    expect(trimmed.length).toBeLessThan(clip.length * 0.5);
    expect(trimmed.length).toBeGreaterThan(16000); // the second of speech is intact
  });
  it("returns nothing for a recording with no speech", () => {
    expect(trimSilence(silence(3)).length).toBe(0);
    expect(preprocess(silence(3)).length).toBe(0);
  });
  it("preprocess trims and normalizes together", () => {
    const out = preprocess(join(silence(1), tone(1, 0.1), silence(1)));
    expect(peak(out)).toBeCloseTo(0.95, 2);
    expect(out.length).toBeLessThan(3 * 16000);
  });
});

describe("normalizeSpoken", () => {
  it("leaves Roman text untouched", () => {
    expect(normalizeSpoken("kal Zomato pe 450 diye")).toBe("kal Zomato pe 450 diye");
  });
  it("turns common Devanagari Hinglish into Roman words for the parser", () => {
    expect(normalizeSpoken("कल ज़ोमैटो पे 450 दिए")).toBe("kal zomato pe 450 diye");
  });
  it("keeps Latin brand names the engine already wrote, and converts Devanagari digits", () => {
    expect(normalizeSpoken("आज Uber पर ४५० रुपये खर्च किया")).toBe("aaj Uber par 450 rupaye kharch kiya");
  });
  it("keeps words it does not know", () => {
    expect(normalizeSpoken("कल समोसा 40")).toBe("kal समोसा 40");
  });
});
