/**
 * Safety-critical keyword red-flagging. Runs on every grievance transcript in
 * addition to the LLM's own is_emergency judgement, so a flag is raised even
 * if the AI service is slow or unavailable.
 *
 * Every keyword must start at a word boundary (so "मारा" does not fire inside
 * "हमारा"). A trailing "$" additionally requires a word boundary at the end
 * (so "आग" does not fire inside "आगे", and "fire" not inside "fired").
 */

const KEYWORDS: string[] = [
  // electrical
  "करंट", "करेंट", "बिजली का झटका", "झटका लगा", "शॉक", "electric shock", "electrocut", "current laga",
  // injury / medical
  "चोट", "घायल", "खून$", "हड्डी टूट", "बेहोश", "गिर गया", "गिर गई", "गिर पड़ा", "दुर्घटना", "एक्सीडेंट",
  "injur", "bleeding", "accident", "unconscious", "fell from",
  // fire / gas / collapse
  "आग$", "धुआं", "गैस लीक", "दीवार गिर", "छत गिर", "fire$", "gas leak", "collapse",
  // sewer / confined space
  "सीवर में", "गटर में", "दम घुट", "suffocat", "manhole",
  // harassment / violence
  "उत्पीड़न", "छेड़छाड़", "छेड़खानी", "यौन", "मारपीट", "मारा$", "पीटा$", "धमकी", "जान से मार",
  "harass", "molest", "sexual", "assault", "threat", "beaten",
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/़/g, "").replace(/\s+/g, " ");
}

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

const ENTRIES = KEYWORDS.map((k) => {
  const wholeWord = k.endsWith("$");
  const raw = wholeWord ? k.slice(0, -1) : k;
  return { raw, norm: normalize(raw), wholeWord };
});

function occursAtBoundary(hay: string, needle: string, wholeWord: boolean): boolean {
  let from = 0;
  while (true) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) return false;
    const before = idx === 0 ? "" : hay[idx - 1];
    const after = hay[idx + needle.length] ?? "";
    const startOk = !before || !WORD_CHAR.test(before);
    const endOk = !wholeWord || !after || !WORD_CHAR.test(after);
    if (startOk && endOk) return true;
    from = idx + 1;
  }
}

/** Returns the distinct emergency keywords found in the text (empty if none). */
export function detectEmergencyKeywords(text: string): string[] {
  const hay = normalize(text);
  const found: string[] = [];
  for (const e of ENTRIES) {
    if (!found.includes(e.raw) && occursAtBoundary(hay, e.norm, e.wholeWord)) found.push(e.raw);
  }
  return found;
}
