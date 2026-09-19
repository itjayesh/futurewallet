/**
 * Speech engines return Hindi in Devanagari, often mixed with Latin brand names. The expense parser
 * reads Roman Hinglish best, so common words are mapped over and Devanagari digits become 0-9.
 * Words that are not in the list are left exactly as spoken.
 */

const DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };

const WORDS: Record<string, string> = {
  कल: "kal",
  आज: "aaj",
  परसों: "parso",
  परसो: "parso",
  अभी: "abhi",
  दिए: "diye",
  दिये: "diye",
  दिया: "diya",
  किया: "kiya",
  खर्च: "kharch",
  खर्चा: "kharcha",
  रुपये: "rupaye",
  रुपए: "rupaye",
  रुपया: "rupaya",
  रूपये: "rupaye",
  पे: "pe",
  पर: "par",
  में: "me",
  से: "se",
  का: "ka",
  की: "ki",
  के: "ke",
  को: "ko",
  और: "aur",
  ऑर्डर: "order",
  खाना: "khana",
  चाय: "chai",
  टैक्सी: "taxi",
  ऑटो: "auto",
  उबर: "uber",
  ओला: "ola",
  स्विगी: "swiggy",
  ज़ोमैटो: "zomato",
  जोमैटो: "zomato",
  ज़ोमेटो: "zomato",
  जोमेटो: "zomato",
  नेटफ्लिक्स: "netflix",
  अमेज़न: "amazon",
  अमेजन: "amazon",
  फ्लिपकार्ट: "flipkart",
  ब्लिंकिट: "blinkit",
  पेट्रोल: "petrol",
  बिजली: "bijli",
  किराया: "kiraya",
  सब्जी: "sabzi",
  दूध: "doodh",
};

const DEVANAGARI = /[ऀ-ॿ]/;

export function normalizeSpoken(text: string): string {
  if (!DEVANAGARI.test(text)) return text.trim();
  const digits = text.replace(/[०-९]/g, (d) => DIGITS[d]);
  return digits
    .split(/(\s+|[,.।?!])/)
    .map((token) => WORDS[token] ?? token)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
