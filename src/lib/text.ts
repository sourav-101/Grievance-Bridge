/** Pure text helpers (no server/browser deps — unit tested). */

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

const NUMBER_WORDS: Record<string, string> = {
  शून्य: "0", जीरो: "0", ज़ीरो: "0", zero: "0",
  एक: "1", one: "1",
  दो: "2", two: "2",
  तीन: "3", three: "3",
  चार: "4", four: "4",
  पांच: "5", पाँच: "5", five: "5",
  छह: "6", छः: "6", छे: "6", six: "6",
  सात: "7", seven: "7",
  आठ: "8", eight: "8",
  नौ: "9", nine: "9",
};

export function devanagariDigitsToAscii(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/**
 * Pull a 4–6 digit ticket token out of typed or spoken text, e.g.
 * "मेरा टोकन 4821 है", "४८२१", "चार आठ दो एक", "48 21".
 */
export function extractTicketToken(text: string): string | null {
  const ascii = devanagariDigitsToAscii(text || "");
  // 1) contiguous digits
  const direct = ascii.match(/(?<!\d)(\d{4,6})(?!\d)/);
  if (direct) return direct[1];
  // 2) digits / number words spoken one by one (possibly separated by spaces, commas, hyphens)
  const words = ascii
    .toLowerCase()
    .replace(/[,.\-–।]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let run = "";
  let best = "";
  for (const w of words) {
    const d = /^\d+$/.test(w) ? w : NUMBER_WORDS[w];
    if (d !== undefined) {
      run += d;
      if (run.length > best.length) best = run;
    } else {
      run = "";
    }
  }
  return best.length >= 4 && best.length <= 6 ? best : null;
}

/** "4821" → "4 8 2 1" so TTS reads the token digit by digit. */
export function spellToken(token: string): string {
  return token.split("").join(" ");
}

export function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Split long text on sentence boundaries so each chunk fits a TTS request limit. */
export function chunkForTts(text: string, max = 2400): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const sentences = clean.split(/(?<=[।.?!])\s+/);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const candidate = cur ? `${cur} ${s}` : s;
    if (candidate.length <= max) {
      cur = candidate;
      continue;
    }
    if (cur) chunks.push(cur);
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max));
      cur = "";
    } else {
      cur = s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Parse a spoken age like "पैंतीस साल" or "35" → number (best effort; LLM handles the rest). */
export function parseAgeDigits(text: string): number | null {
  const m = devanagariDigitsToAscii(text).match(/(?<!\d)(\d{2})(?!\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 100 ? n : null;
}
