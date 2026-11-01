/**
 * IIT Roorkee campus zones + domain-specific auto-correction.
 *
 * ⚠️  Coordinates are APPROXIMATE, hand-placed around the campus centre for the
 *     prototype heatmap. Verify each point (e.g. on OpenStreetMap) before use.
 *     Add or rename zones here; ids are stored in grievances.campus_zone.
 */

export interface CampusZone {
  id: string;
  nameEn: string;
  nameHi: string;
  type: "academic" | "admin" | "hostel" | "health" | "residential" | "facility" | "other";
  lat: number;
  lng: number;
  /** Spoken / written variants (Hindi + romanised) that should map to this zone. */
  aliases: string[];
}

export const CAMPUS_CENTER = { lat: 29.8649, lng: 77.8966 };

function hostel(id: string, en: string, hi: string, lat: number, lng: number, extra: string[] = []): CampusZone {
  return {
    id,
    nameEn: `${en} Bhawan`,
    nameHi: `${hi} भवन`,
    type: "hostel",
    lat,
    lng,
    aliases: [
      `${hi} भवन`,
      `${hi} हॉस्टल`,
      `${hi} होस्टल`,
      `${en.toLowerCase()} bhawan`,
      `${en.toLowerCase()} bhavan`,
      `${en.toLowerCase()} hostel`,
      ...extra,
    ],
  };
}

export const CAMPUS_ZONES: CampusZone[] = [
  {
    id: "thomason",
    nameEn: "Thomason Building (Main Building)",
    nameHi: "थॉमसन बिल्डिंग",
    type: "admin",
    lat: 29.8646,
    lng: 77.8964,
    aliases: ["थॉमसन बिल्डिंग", "थामसन बिल्डिंग", "थोमसन बिल्डिंग", "टॉमसन बिल्डिंग", "थॉमसन", "मेन बिल्डिंग", "मुख्य भवन", "thomason building", "thomson building", "main building"],
  },
  {
    id: "estate_office",
    nameEn: "Estate Office",
    nameHi: "एस्टेट ऑफिस",
    type: "admin",
    lat: 29.8652,
    lng: 77.8951,
    aliases: ["एस्टेट ऑफिस", "एस्टेट ऑफ़िस", "इस्टेट ऑफिस", "संपदा कार्यालय", "estate office"],
  },
  {
    id: "library",
    nameEn: "Mahatma Gandhi Central Library",
    nameHi: "केंद्रीय पुस्तकालय",
    type: "academic",
    lat: 29.8657,
    lng: 77.8972,
    aliases: ["लाइब्रेरी", "लायब्रेरी", "पुस्तकालय", "केंद्रीय पुस्तकालय", "central library", "library"],
  },
  {
    id: "lhc",
    nameEn: "Lecture Hall Complex",
    nameHi: "लेक्चर हॉल कॉम्प्लेक्स",
    type: "academic",
    lat: 29.8662,
    lng: 77.8946,
    aliases: ["लेक्चर हॉल", "लेक्चर हॉल कॉम्प्लेक्स", "एलएचसी", "lhc", "lecture hall"],
  },
  {
    id: "mac",
    nameEn: "Multi Activity Centre (MAC)",
    nameHi: "मल्टी एक्टिविटी सेंटर",
    type: "facility",
    lat: 29.8637,
    lng: 77.8988,
    aliases: ["मल्टी एक्टिविटी सेंटर", "मैक", "mac", "multi activity centre", "multi activity center"],
  },
  {
    id: "convocation",
    nameEn: "Convocation Hall",
    nameHi: "दीक्षांत सभागार",
    type: "facility",
    lat: 29.8641,
    lng: 77.8942,
    aliases: ["कन्वोकेशन हॉल", "दीक्षांत सभागार", "convocation hall"],
  },
  {
    id: "hospital",
    nameEn: "Institute Hospital",
    nameHi: "संस्थान अस्पताल",
    type: "health",
    lat: 29.8627,
    lng: 77.8952,
    aliases: ["अस्पताल", "हॉस्पिटल", "होस्पिटल", "डिस्पेंसरी", "संस्थान अस्पताल", "hospital", "dispensary"],
  },
  {
    id: "sports",
    nameEn: "Sports Complex / Stadium",
    nameHi: "खेल परिसर",
    type: "facility",
    lat: 29.8671,
    lng: 77.8994,
    aliases: ["स्टेडियम", "खेल परिसर", "स्पोर्ट्स कॉम्प्लेक्स", "ग्राउंड", "stadium", "sports complex"],
  },
  {
    id: "main_gate",
    nameEn: "Main Gate",
    nameHi: "मुख्य द्वार",
    type: "facility",
    lat: 29.8623,
    lng: 77.8932,
    aliases: ["मेन गेट", "मुख्य द्वार", "मुख्य गेट", "main gate"],
  },
  {
    id: "residential",
    nameEn: "Staff & Faculty Residential Area",
    nameHi: "आवासीय क्षेत्र",
    type: "residential",
    lat: 29.8688,
    lng: 77.8925,
    aliases: ["आवासीय क्षेत्र", "क्वार्टर", "कॉलोनी", "स्टाफ कॉलोनी", "residential area", "staff colony"],
  },
  hostel("govind", "Govind", "गोविंद", 29.8693, 77.8972, ["हॉस्टल 8", "hostel 8"]),
  hostel("rajendra", "Rajendra", "राजेंद्र", 29.8681, 77.8958),
  hostel("ravindra", "Ravindra", "रवींद्र", 29.8676, 77.8981, ["रविंद्र भवन"]),
  hostel("cautley", "Cautley", "कॉटले", 29.8668, 77.8935, ["कॉटली भवन", "काटले भवन"]),
  hostel("ganga", "Ganga", "गंगा", 29.8701, 77.8949),
  hostel("jawahar", "Jawahar", "जवाहर", 29.8708, 77.8986),
  hostel("azad", "Azad", "आज़ाद", 29.8714, 77.8962, ["आजाद भवन"]),
  hostel("radhakrishnan", "Radhakrishnan", "राधाकृष्णन", 29.8697, 77.9004),
  hostel("rajiv", "Rajiv", "राजीव", 29.8722, 77.8941),
  hostel("malviya", "Malviya", "मालवीय", 29.8684, 77.9011),
  hostel("kasturba", "Kasturba", "कस्तूरबा", 29.8632, 77.9003, ["कस्तुरबा भवन"]),
  hostel("sarojini", "Sarojini", "सरोजिनी", 29.8624, 77.8986),
  hostel("himalaya", "Himalaya", "हिमालय", 29.8617, 77.9014),
  {
    id: "khosla",
    nameEn: "Khosla International House",
    nameHi: "खोसला इंटरनेशनल हाउस",
    type: "hostel",
    lat: 29.8655,
    lng: 77.9019,
    aliases: ["खोसला", "खोसला इंटरनेशनल हाउस", "khosla", "khosla international house"],
  },
  {
    id: "other",
    nameEn: "Other / Elsewhere on campus",
    nameHi: "कैंपस में कहीं और",
    type: "other",
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng,
    aliases: [],
  },
];

export const ZONES_BY_ID: Record<string, CampusZone> = Object.fromEntries(CAMPUS_ZONES.map((z) => [z.id, z]));

export function getZone(id: string | null | undefined): CampusZone | null {
  return id ? ZONES_BY_ID[id] ?? null : null;
}

/** Glossary line for LLM prompts: "id: English / हिंदी". */
export function zoneGlossary(): string {
  return CAMPUS_ZONES.map((z) => `${z.id}: ${z.nameEn} / ${z.nameHi}`).join("\n");
}

/** Up to 50 short key terms to bias Sarvam STT (saaras:v4 `keyterms`). Each ≤ 64 chars. */
export function sttKeyterms(): string[] {
  const terms = new Set<string>(["IIT Roorkee", "आईआईटी रुड़की", "एस्टेट ऑफिस", "ठेकेदार", "ई-श्रम", "आयुष्मान"]);
  for (const z of CAMPUS_ZONES) {
    if (z.id === "other") continue;
    terms.add(z.nameHi);
    if (terms.size >= 50) break;
  }
  return [...terms].slice(0, 50).map((t) => t.slice(0, 64));
}

// ----------------------------------------------------------------- Auto-correction

/** Normalise Devanagari/Latin spelling variation so "गोविन्द" ≈ "गोविंद", "थामसन" ≈ "थॉमसन". */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFC")
    .replace(/[‌‍]/g, "") // ZWNJ / ZWJ
    .replace(/़/g, "") // nukta
    .replace(/ँ/g, "ं") // chandrabindu → anusvara
    .replace(/[ॉो]/g, "ा") // ॉ / ो → ा
    .replace(/[नमणङञ]्(?=[क-ह])/g, "ं") // half nasal before consonant → anusvara
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const ac = [...a];
  const bc = [...b];
  if (!ac.length) return bc.length;
  if (!bc.length) return ac.length;
  let prev = Array.from({ length: bc.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ac.length; i++) {
    const cur = [i];
    for (let j = 1; j <= bc.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ac[i - 1] === bc[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[bc.length];
}

function allowedDistance(alias: string): number {
  const len = [...alias].length;
  if (len >= 12) return 2;
  if (len >= 6) return 1;
  return 0;
}

interface AliasEntry {
  zone: CampusZone;
  norm: string;
  words: number;
}

const ALIAS_INDEX: AliasEntry[] = CAMPUS_ZONES.flatMap((zone) =>
  zone.aliases.map((a) => {
    const norm = normalizeForMatch(a);
    return { zone, norm, words: norm.split(" ").length };
  }),
);

export interface AutocorrectResult {
  text: string;
  zoneIds: string[];
}

/**
 * Domain spell-checker: scans 1–3 word windows of a transcript and replaces
 * fuzzy matches of campus place names with their canonical Hindi name.
 */
export function autocorrectCampusTerms(transcript: string): AutocorrectResult {
  const tokens = transcript.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const zoneIds: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched: { zone: CampusZone; span: number } | null = null;
    for (let span = Math.min(3, tokens.length - i); span >= 1 && !matched; span--) {
      const windowText = tokens.slice(i, i + span).join(" ");
      const normWindow = normalizeForMatch(windowText);
      if (!normWindow) continue;
      let best: { entry: AliasEntry; d: number } | null = null;
      for (const entry of ALIAS_INDEX) {
        if (entry.words !== span) continue;
        const d = levenshtein(normWindow, entry.norm);
        if (d <= allowedDistance(entry.norm) && (!best || d < best.d)) best = { entry, d };
      }
      if (best) matched = { zone: best.entry.zone, span };
    }
    if (matched) {
      // Keep any trailing punctuation from the last token of the window.
      const last = tokens[i + matched.span - 1];
      const trailing = last.match(/[।,.?!]+$/)?.[0] ?? "";
      out.push(matched.zone.nameHi + trailing);
      if (!zoneIds.includes(matched.zone.id)) zoneIds.push(matched.zone.id);
      i += matched.span;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return { text: out.join(" "), zoneIds };
}
