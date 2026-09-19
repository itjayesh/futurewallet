import type { Language } from "@/lib/db/types";

/**
 * The user's language setting, turned into an instruction the AI layer will follow.
 * It is added at the route level, so the model sees it as part of the facts or the message.
 */
export const REPLY_LANGUAGE: Record<Language, string> = {
  en: "English",
  hinglish: "Hinglish (Hindi written in Roman letters, mixed with English, the way friends text)",
  hi: "Hindi in Devanagari script",
};

const NUMBERS = "Write every number with Western digits 0-9 and the ₹ symbol, never Devanagari digits.";

export const languageRule = (language: Language): string => `Write the reply in ${REPLY_LANGUAGE[language]}. ${NUMBERS}`;

/** For chat: the instruction rides along with the user's message. The saved history keeps the original text. */
export const withLanguage = (message: string, language: Language): string => `${message}\n\n(${languageRule(language)})`;

/** For written text: the instruction sits next to the computed facts. */
export function factsWithLanguage<T extends object>(facts: T, language: Language): T {
  return { ...facts, reply_language: languageRule(language) };
}
