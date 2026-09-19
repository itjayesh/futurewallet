import { describe, expect, it } from "vitest";
import { cleanAiText, formatRupees, splitLongParagraph, stripMarkdown, toBlocks } from "./aiText";

// A real advisor reply that showed up as one dense paragraph with literal asterisks.
const REAL =
  "Nice catch on the text, but I can't use **Meera** because your profile name is **JAYESH**. Here's the fuller picture: you saved **₹11833** this month, with a savings rate of **26%**. You're doing well in **Food & Dining (₹4846 of ₹7500)**, **Groceries (₹2619 of ₹3500)**, and **Transport (₹2166 of ₹2500)**. The main leak is still **Shopping at ₹2626 vs ₹2000**. So the simple fix is: **pause non-essentials in Shopping until the month closes**. That's the cleanest way to protect the savings you've already built.";

describe("formatRupees", () => {
  it("groups amounts the Indian way", () => {
    expect(formatRupees("₹11833 and ₹4846 of ₹7500")).toBe("₹11,833 and ₹4,846 of ₹7,500");
    expect(formatRupees("₹125000")).toBe("₹1,25,000");
  });
  it("leaves small amounts, already grouped amounts and decimals alone", () => {
    expect(formatRupees("₹450 and ₹1,800")).toBe("₹450 and ₹1,800");
    expect(formatRupees("₹1.5L")).toBe("₹1.5L");
  });
  it("does not change values", () => {
    expect(formatRupees("₹2000")).toBe("₹2,000");
  });
});

describe("stripMarkdown / cleanAiText", () => {
  it("removes bold markers and headings", () => {
    expect(stripMarkdown("**Bold** and __also__ and `code`")).toBe("Bold and also and code");
    expect(stripMarkdown("## Title\ntext")).toBe("Title\ntext");
  });
  it("drops a lone opening ** while a reply is still streaming", () => {
    expect(stripMarkdown("you saved **₹118")).toBe("you saved ₹118");
  });
  it("cleans the real reply into readable plain text", () => {
    const clean = cleanAiText(REAL);
    expect(clean).not.toContain("**");
    expect(clean).toContain("₹11,833");
    expect(clean).toContain("Food & Dining (₹4,846 of ₹7,500)");
  });
});

describe("splitLongParagraph", () => {
  it("keeps short text in one piece", () => {
    expect(splitLongParagraph("One short sentence.")).toEqual(["One short sentence."]);
  });
  it("breaks the real reply into shorter paragraphs at sentence ends", () => {
    const parts = splitLongParagraph(REAL);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 260)).toBe(true);
    expect(parts.join(" ")).toBe(REAL);
  });
  it("does not split inside a number like ₹1.5L", () => {
    const text = "You need ₹1.5L for the bike. " + "Keep saving every single month without skipping any of them. ".repeat(6);
    const parts = splitLongParagraph(text, 100);
    expect(parts[0].startsWith("You need ₹1.5L for the bike.")).toBe(true);
  });
});

describe("toBlocks", () => {
  it("makes paragraphs, bullet lists and numbered lists", () => {
    const blocks = toBlocks("Intro line.\n\n- one\n- two\n\n1. first\n2. second");
    expect(blocks).toEqual([
      { type: "p", text: "Intro line." },
      { type: "ul", items: ["one", "two"] },
      { type: "ol", items: ["first", "second"] },
    ]);
  });
  it("turns headings into their own block", () => {
    expect(toBlocks("## Plan\nDo this.")).toEqual([
      { type: "h", text: "Plan" },
      { type: "p", text: "Do this." },
    ]);
  });
});
