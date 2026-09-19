import type { Language } from "@/lib/db/types";

/**
 * Interface strings in English, Hinglish and Hindi. Each entry is [en, hinglish, hi].
 * Screens not listed here stay in English; the advisor's own replies follow the language setting on the server.
 */
const D = {
  // navigation
  nav_dashboard: ["Dashboard", "Dashboard", "डैशबोर्ड"],
  nav_add: ["Add expense", "Kharcha jodo", "खर्च जोड़ें"],
  nav_budget: ["Budget", "Budget", "बजट"],
  nav_goals: ["Goals", "Goals", "लक्ष्य"],
  nav_future: ["Future You", "Future You", "आपका भविष्य"],
  nav_advisor: ["Advisor", "Advisor", "सलाहकार"],
  nav_settings: ["Settings", "Settings", "सेटिंग्स"],
  nav_personality: ["Money personality", "Money personality", "पैसों की पर्सनैलिटी"],
  short_dashboard: ["Home", "Home", "होम"],
  short_add: ["Add", "Jodo", "जोड़ें"],
  short_budget: ["Budget", "Budget", "बजट"],
  short_goals: ["Goals", "Goals", "लक्ष्य"],
  short_future: ["Future", "Future", "भविष्य"],
  short_advisor: ["Advisor", "Advisor", "सलाह"],
  wrapped: ["Wrapped", "Wrapped", "रैप्ड"],
  ask_advisor: ["Ask advisor", "Advisor se pucho", "सलाहकार से पूछें"],
  add_expense: ["Add expense", "Kharcha jodo", "खर्च जोड़ें"],

  // dashboard
  greeting: ["Your money today", "Aaj ka hisaab", "आज का हिसाब"],
  financial_health: ["Financial health", "Financial health", "वित्तीय सेहत"],
  spent_vs_budget: ["Spent vs budget", "Kharcha vs budget", "खर्च बनाम बजट"],
  saved_so_far: ["Saved this month so far", "Is mahine ab tak ki bachat", "इस महीने अब तक की बचत"],
  by_category: ["Spending by category", "Category ke hisaab se kharcha", "श्रेणी के हिसाब से खर्च"],
  trend6: ["6-month trend", "6 mahine ka trend", "6 महीने का रुझान"],
  top_merchants: ["Top merchants", "Top merchants", "सबसे ज़्यादा खर्च वाली दुकानें"],
  insight_title: ["Insight from your advisor", "Advisor ka insight", "आपके सलाहकार की राय"],
  ask_about_this: ["Ask the advisor about this", "Advisor se iske baare me pucho", "इस बारे में सलाहकार से पूछें"],
  triggers: ["Spending triggers", "Kharche ke triggers", "खर्च के कारण"],
  personality: ["Your money personality", "Aapki money personality", "आपकी पैसों की पर्सनैलिटी"],
  see_card: ["See your card and plan", "Apna card aur plan dekho", "अपना कार्ड और प्लान देखें"],
  wrapped_ready: ["Your {month} Wrapped is ready.", "Aapka {month} Wrapped ready hai.", "आपका {month} रैप्ड तैयार है।"],
  wrapped_sub: [
    "A swipeable recap of where your money went. Takes about a minute.",
    "Swipe karke dekho paisa kahan gaya. Bas ek minute.",
    "स्वाइप करके देखें कि पैसा कहाँ गया। बस एक मिनट।",
  ],
  play_wrapped: ["Play Wrapped", "Wrapped chalao", "रैप्ड चलाएँ"],

  // add expense, budget, goals, future
  tab_type: ["Type it", "Likh ke jodo", "लिखकर जोड़ें"],
  tab_manual: ["Manual form", "Manual form", "फ़ॉर्म भरें"],
  tab_csv: ["Import CSV", "CSV import", "CSV इम्पोर्ट"],
  describe_expense: ["Describe the expense", "Kharcha likho", "खर्च लिखें"],
  parse: ["Parse", "Samjho", "समझें"],
  save_expense: ["Save expense", "Kharcha save karo", "खर्च सेव करें"],
  recent_entries: ["Recent entries", "Haal ki entries", "हाल की प्रविष्टियाँ"],
  speak: ["Speak", "Bolo", "बोलें"],
  generate_budget: ["Generate budget", "Budget banao", "बजट बनाएँ"],
  regenerate_budget: ["Regenerate budget", "Budget dobara banao", "बजट दोबारा बनाएँ"],
  category_limits: ["Category limits", "Category ki limits", "श्रेणी की सीमाएँ"],
  new_goal: ["New goal", "Naya goal", "नया लक्ष्य"],
  add_contribution: ["Add contribution", "Paisa jodo", "राशि जोड़ें"],
  monthly_savings: ["Monthly savings", "Mahine ki bachat", "मासिक बचत"],
  future_message: ["A message from you in {years} years", "{years} saal baad ke aap ka message", "{years} साल बाद के आप का संदेश"],

  // settings
  s_language: ["Language", "Bhasha", "भाषा"],
  s_language_hint: [
    "Used for the app, the advisor's replies and voice input.",
    "App, advisor ke jawab aur voice input ke liye.",
    "ऐप, सलाहकार के जवाब और वॉइस इनपुट के लिए।",
  ],
  s_advisor: ["Advisor style", "Advisor ka style", "सलाहकार का अंदाज़"],
  s_profile: ["Profile", "Profile", "प्रोफ़ाइल"],
  s_name: ["Name", "Naam", "नाम"],
  s_income: ["Monthly income (₹)", "Mahine ki income (₹)", "मासिक आय (₹)"],
  s_fixed: ["Fixed monthly costs", "Fixed mahine ke kharche", "तय मासिक खर्च"],
  s_add_fixed: ["Add fixed cost", "Fixed kharcha jodo", "तय खर्च जोड़ें"],
  s_save: ["Save changes", "Changes save karo", "बदलाव सेव करें"],
  s_saved: ["Saved.", "Save ho gaya.", "सेव हो गया।"],
  s_appearance: ["Appearance", "Look", "रूप-रंग"],
  s_theme: ["Theme", "Theme", "थीम"],
  s_theme_system: ["System", "System", "सिस्टम"],
  s_theme_light: ["Light", "Light", "लाइट"],
  s_theme_dark: ["Dark", "Dark", "डार्क"],
  s_text_size: ["Text size", "Text ka size", "अक्षरों का आकार"],
  s_size_normal: ["Comfortable", "Normal", "सामान्य"],
  s_size_large: ["Large", "Bada", "बड़ा"],
  s_size_xl: ["Extra large", "Bahut bada", "बहुत बड़ा"],
  s_voice: ["Voice input", "Voice input", "वॉइस इनपुट"],
  s_voice_hint: [
    "Say an expense instead of typing it.",
    "Expense type karne ki jagah bolo.",
    "खर्च टाइप करने की जगह बोलकर जोड़ें।",
  ],
  s_voice_engine: ["Voice engine", "Voice engine", "वॉइस इंजन"],
  s_voice_model: ["Voice model", "Voice model", "वॉइस मॉडल"],
  s_voice_fast: ["Fast (about 40 MB)", "Fast (~40 MB)", "तेज़ (लगभग 40 MB)"],
  s_voice_better: ["Better (about 80 MB)", "Better (~80 MB)", "बेहतर (लगभग 80 MB)"],
  s_voice_best: ["Best (about 250 MB)", "Best (~250 MB)", "सर्वश्रेष्ठ (लगभग 250 MB)"],
  s_voice_clear: ["Remove downloaded voice model", "Downloaded voice model hatao", "डाउनलोड किया मॉडल हटाएँ"],
  s_voice_cleared: ["Voice model removed. It downloads again next time you use the microphone.", "Voice model hat gaya. Agli baar mic use karoge to dobara download hoga.", "वॉइस मॉडल हट गया। अगली बार माइक इस्तेमाल करने पर फिर डाउनलोड होगा।"],
  s_data: ["Your data", "Aapka data", "आपका डेटा"],
  d_demo: ["Load demo data", "Demo data load karo", "डेमो डेटा लोड करें"],
  d_expenses: ["Delete all expenses", "Saare kharche delete karo", "सभी खर्च हटाएँ"],
  d_budget: ["Delete this month's budget", "Is mahine ka budget delete karo", "इस महीने का बजट हटाएँ"],
  d_goals: ["Delete all goals", "Saare goals delete karo", "सभी लक्ष्य हटाएँ"],
  d_chat: ["Clear advisor chat history", "Chat history saaf karo", "चैट इतिहास साफ़ करें"],
  d_all: ["Delete all my data", "Mera saara data delete karo", "मेरा सारा डेटा हटाएँ"],
  d_account: ["Delete my account", "Mera account delete karo", "मेरा अकाउंट हटाएँ"],
  s_danger: ["Danger zone", "Danger zone", "ख़तरनाक क्षेत्र"],
  confirm_yes: ["Yes, delete", "Haan, delete karo", "हाँ, हटाएँ"],
  cancel: ["Cancel", "Cancel", "रद्द करें"],
  sign_out: ["Sign out", "Sign out", "साइन आउट"],
  s_account: ["Account", "Account", "अकाउंट"],
} as const;

export type TKey = keyof typeof D;
const INDEX: Record<Language, 0 | 1 | 2> = { en: 0, hinglish: 1, hi: 2 };

export function translate(key: TKey, language: Language, vars?: Record<string, string | number>): string {
  let text: string = D[key][INDEX[language]];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export const LANGUAGE_LABELS: Record<Language, { native: string; hint: string }> = {
  en: { native: "English", hint: "Plain English" },
  hinglish: { native: "Hinglish", hint: "Hindi in Roman letters, mixed with English" },
  hi: { native: "हिन्दी", hint: "Hindi in Devanagari" },
};
