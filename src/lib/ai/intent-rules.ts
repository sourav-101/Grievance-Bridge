/**
 * Keyword fallbacks used when the AI service (Groq) is not configured or fails,
 * so voice complaints, status checks and sign-up keep working. Pure functions
 * (unit tested); the LLM path stays the primary one.
 */
import { extractTicketToken, parseAgeDigits } from "../text";
import type { GrievanceCategory } from "../types";

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const CATEGORY_WORDS: [GrievanceCategory, string[]][] = [
  ["Harassment", ["उत्पीड़न", "छेड़", "छेड", "गाली", "धमकी", "मारपीट", "पीटा", "बदतमीज़ी", "harass", "abuse", "threat"]],
  ["Wage Dispute", ["वेतन", "तनख्वाह", "तनख़्वाह", "सैलरी", "पगार", "मज़दूरी", "मजदूरी", "पैसा", "पैसे", "रिश्वत", "कमीशन", "पीएफ", "salary", "wage", "payment"]],
  ["Safety/PPE", ["हेलमेट", "दस्ताने", "जूते", "मास्क", "सुरक्षा", "करंट", "चोट", "खतरा", "ख़तरा", "गिर", "helmet", "gloves", "safety", "injur"]],
  ["Sanitation", ["पानी", "शौचालय", "टॉयलेट", "कचरा", "गंदगी", "सफ़ाई", "सफाई", "नाली", "सीवर", "बदबू", "water", "toilet", "garbage"]],
];

export function guessCategory(text: string): GrievanceCategory {
  const t = text.toLowerCase();
  for (const [cat, words] of CATEGORY_WORDS) if (has(t, words)) return cat;
  return "General";
}

const STATUS_WORDS = ["स्थिति", "स्टेटस", "टोकन", "क्या हुआ", "कहां तक", "कहाँ तक", "status", "token"];
const QUESTION_WORDS = ["क्या", "कैसे", "कब", "कितना", "कितनी", "कितने", "कौन", "कहां", "कहाँ", "बताइए", "बताओ", "बताएं", "जानकारी", "योजना", "कार्ड", "?"];
const COMPLAINT_WORDS = ["नहीं मिल", "नहीं आ", "नहीं दे", "नहीं दिया", "शिकायत", "समस्या", "परेशान", "काट", "खराब", "ख़राब", "टूट", "बंद है"];

export type RuleIntent = "grievance" | "information" | "status_check" | "other";

export function guessIntent(text: string): RuleIntent {
  const t = text.toLowerCase();
  if (extractTicketToken(t) && has(t, STATUS_WORDS)) return "status_check";
  if (has(t, COMPLAINT_WORDS) || guessCategory(t) !== "General") {
    // "वेतन कब मिलेगा?" is a question; "वेतन नहीं मिला" is a complaint.
    return has(t, COMPLAINT_WORDS) || !has(t, QUESTION_WORDS) ? "grievance" : "information";
  }
  if (has(t, QUESTION_WORDS)) return "information";
  return "other";
}

/** "मेरा नाम रमेश कुमार है, उम्र 35 साल" → { fullName: "रमेश कुमार", age: 35 } (best effort). */
export function guessNameAndAge(text: string): { fullName: string; age: number | null } {
  const m = text.match(/(?:नाम|name)\s*(?:है|is|:)?\s*([^\s,।.0-9०-९]+(?:\s+[^\s,।.0-9०-९]+)?)/i);
  let name = (m?.[1] ?? "").replace(/\s*(है|हैं|जी|और)$/u, "").trim();
  if (/^(है|हैं|जी|और)$/.test(name)) name = "";
  return { fullName: name.slice(0, 100), age: parseAgeDigits(text) };
}

const UNSATISFIED_WORDS = ["नहीं", "नही ", "खराब", "ख़राब", "असंतुष्ट", "अभी भी", "वैसा ही", "not ", "bad"];

/** Same rule as the AI prompt: "Unsatisfied" only when the worker voices a complaint. */
export function guessFeedback(text: string): "Satisfied" | "Unsatisfied" {
  const t = text.toLowerCase();
  if (/कोई\s+(दिक्कत|शिकायत|समस्या|परेशानी)\s+नहीं/.test(t)) return "Satisfied";
  if (has(t, UNSATISFIED_WORDS)) return "Unsatisfied";
  return "Satisfied";
}
