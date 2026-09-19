/**
 * Display formatting for text the AI wrote. It only changes how the text looks (markdown markers,
 * rupee grouping, paragraph breaks); it never changes a figure's value.
 */

/** ₹11833 -> ₹11,833 (Indian digit grouping). Only amounts of four or more digits are touched. */
export const formatRupees = (text: string): string =>
  text.replace(/₹\s?(\d{4,})(\.\d+)?/g, (_, whole: string, decimals?: string) => `₹${Number(whole).toLocaleString("en-IN")}${decimals ?? ""}`);

/** Removes markdown markers, for places that show plain text (a typewriter, a notice). */
export const stripMarkdown = (text: string): string =>
  text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "");

export const cleanAiText = (text: string): string => formatRupees(stripMarkdown(text)).trim();

export type Block = { type: "p"; text: string } | { type: "h"; text: string } | { type: "ul" | "ol"; items: string[] };

const BULLET = /^([-*•])\s+/;
const NUMBERED = /^\d+[.)]\s+/;

/** Splits at ., !, ? or । that is followed by a space or the end. A full stop inside a number (₹1.5L) is not a sentence end. */
function sentencesOf(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < paragraph.length; i++) {
    if (!/[.!?।]/.test(paragraph[i])) continue;
    let end = i + 1;
    while (end < paragraph.length && /["')\]]/.test(paragraph[end])) end++;
    if (end === paragraph.length || /\s/.test(paragraph[end])) {
      out.push(paragraph.slice(start, end).trim());
      start = end;
      i = end - 1;
    }
  }
  if (start < paragraph.length && paragraph.slice(start).trim()) out.push(paragraph.slice(start).trim());
  return out;
}

/** Splits a long paragraph at sentence ends into pieces of at most `max` characters, so a wall of text becomes short paragraphs. */
export function splitLongParagraph(paragraph: string, max = 230): string[] {
  if (paragraph.length <= max) return [paragraph];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentencesOf(paragraph)) {
    if (current && (current + " " + sentence).length > max) {
      out.push(current);
      current = sentence;
    } else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) out.push(current);
  return out;
}

/** Turns model text into headings, paragraphs and lists. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) for (const p of splitLongParagraph(paragraph.join(" "))) blocks.push({ type: "p", text: p });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h", text: line.replace(/^#{1,6}\s+/, "") });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      flushParagraph();
      const type = NUMBERED.test(line) ? "ol" : "ul";
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push(line.replace(BULLET, "").replace(NUMBERED, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
