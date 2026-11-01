import "server-only";
import { autocorrectCampusTerms, getZone, zoneGlossary } from "../campus";
import { GRIEVANCE_CATEGORY_IDS, isGrievanceCategory } from "../constants";
import { detectEmergencyKeywords } from "../grievances/emergency";
import { ConfigError } from "../env";
import { guessCategory, guessFeedback, guessIntent, guessNameAndAge } from "./intent-rules";
import { extractTicketToken } from "../text";
import type { GrievanceCategory } from "../types";
import { groqJson } from "./groq";

export type Intent = "grievance" | "information" | "status_check" | "other";

export interface Classification {
  intent: Intent;
  /** Transcript after campus-term auto-correction and LLM clean-up (Hindi). */
  correctedTranscript: string;
  /** Short retrieval query for the knowledge base / web. */
  searchQuery: string;
  category: GrievanceCategory;
  zoneId: string | null;
  locationText: string;
  summaryEnglish: string;
  isEmergency: boolean;
  emergencyKeywords: string[];
  ticketToken: string | null;
}

const SYSTEM = `You are the intent classifier for a voice assistant used by contract workers at IIT Roorkee, India.
Input is a speech-to-text transcript in Hindi, English or a regional dialect (Bhojpuri, Garhwali, Kumaoni, Western UP Hindi). It may contain recognition mistakes.

Classify the intent:
- "grievance": the worker reports a problem/complaint (unpaid or low wages, deductions, bribes/kickbacks, no safety gear, injury, water/toilet problem, harassment, abuse, unsafe work, etc.)
- "information": the worker asks for information (government schemes, minimum wage, salary date, health camp, hospital timing, documents needed, rights, rules)
- "status_check": the worker asks about the status of an existing complaint/ticket/token number
- "other": greetings, unclear speech, or anything else

Grievance categories (use exactly one): ${GRIEVANCE_CATEGORY_IDS.join(", ")}.

Known campus locations (id: English / Hindi). Map any spoken place to the closest id, even with misspellings; use null if no location is mentioned:
${zoneGlossary()}

Mark is_emergency=true for immediate danger to life or safety: electric shock, injury, bleeding, fire, gas leak, collapse, someone trapped/suffocating in a sewer, sexual harassment, physical assault or threats.

Return JSON only:
{
  "intent": "grievance" | "information" | "status_check" | "other",
  "corrected_transcript": "<transcript cleaned up in the language spoken (Devanagari for Hindi/dialects, English letters for English), fixing obvious recognition errors, same meaning>",
  "search_query": "<short Hindi or English search query capturing the question, empty if not information>",
  "category": "<one category, or General>",
  "zone_id": "<location id or null>",
  "location_text": "<location as the worker said it, in Hindi, or empty>",
  "summary_english": "<one or two sentence formal English summary for university records, empty if not grievance>",
  "is_emergency": true | false,
  "ticket_token": "<4-6 digit token if mentioned, else null>"
}`;

interface RawClassification {
  intent?: string;
  corrected_transcript?: string;
  search_query?: string;
  category?: string;
  zone_id?: string | null;
  location_text?: string;
  summary_english?: string;
  is_emergency?: boolean;
  ticket_token?: string | null;
}

export async function classifyUtterance(rawTranscript: string, opts: { forceGrievance?: boolean } = {}): Promise<Classification> {
  const auto = autocorrectCampusTerms(rawTranscript);
  let raw: RawClassification;
  try {
    raw = await groqJson<RawClassification>(
      SYSTEM,
      `TRANSCRIPT: ${auto.text}${opts.forceGrievance ? "\n(The worker pressed the COMPLAINT button, so treat this as a grievance.)" : ""}`,
      { temperature: 0, maxTokens: 600 },
    );
  } catch (e) {
    // AI unavailable: keyword rules still route the request (emergency keywords and
    // campus auto-correction below work without the LLM).
    if (!(e instanceof ConfigError)) console.warn("classifier: AI failed, using keyword rules", e);
    raw = { intent: guessIntent(auto.text), category: guessCategory(auto.text) };
  }

  const intent: Intent = opts.forceGrievance
    ? "grievance"
    : (["grievance", "information", "status_check", "other"] as const).includes(raw.intent as Intent)
      ? (raw.intent as Intent)
      : "other";

  const corrected = (raw.corrected_transcript || auto.text).trim();
  const zoneFromLlm = raw.zone_id && getZone(raw.zone_id) ? raw.zone_id : null;
  const zoneId = zoneFromLlm ?? auto.zoneIds[0] ?? null;
  const keywordHits = detectEmergencyKeywords(`${rawTranscript} ${corrected}`);

  return {
    intent,
    correctedTranscript: corrected,
    searchQuery: (raw.search_query || corrected).trim(),
    category: isGrievanceCategory(raw.category) ? raw.category : "General",
    zoneId,
    locationText: (raw.location_text || getZone(zoneId)?.nameHi || "").trim(),
    summaryEnglish: (raw.summary_english || "").trim(),
    isEmergency: Boolean(raw.is_emergency) || keywordHits.length > 0,
    emergencyKeywords: keywordHits,
    ticketToken:
      (typeof raw.ticket_token === "string" && /^\d{4,6}$/.test(raw.ticket_token) ? raw.ticket_token : null) ??
      extractTicketToken(rawTranscript),
  };
}

/** Extract name + age from the onboarding utterance ("मेरा नाम रमेश है, उम्र पैंतीस साल"). */
export async function extractNameAndAge(transcript: string): Promise<{ fullName: string; age: number | null }> {
  let r: { full_name?: string; age?: number | string | null };
  try {
    r = await groqJson<{ full_name?: string; age?: number | string | null }>(
      `Extract the speaker's name and age from a Hindi/dialect self-introduction transcript.
Write the name in Devanagari as spoken (no honorifics like "जी", no "मेरा नाम"). Age as an integer 14-99 or null.
Return JSON: {"full_name": "...", "age": 35}`,
      transcript,
      { temperature: 0, maxTokens: 100 },
    );
  } catch (e) {
    if (!(e instanceof ConfigError)) console.warn("extractNameAndAge: AI failed, using rules", e);
    const g = guessNameAndAge(transcript);
    r = { full_name: g.fullName, age: g.age };
  }
  const ageNum = typeof r.age === "string" ? parseInt(r.age, 10) : r.age;
  return {
    fullName: (r.full_name || "").trim().slice(0, 100),
    age: typeof ageNum === "number" && ageNum > 0 && ageNum < 100 ? ageNum : null,
  };
}

/** Decide Satisfied / Unsatisfied from a short spoken rating. */
export async function classifyFeedback(transcript: string): Promise<"Satisfied" | "Unsatisfied"> {
  try {
    const r = await groqJson<{ rating?: string }>(
      `A worker gave spoken feedback (Hindi/dialect) on whether their complaint was resolved well.
Return JSON {"rating": "Satisfied"} or {"rating": "Unsatisfied"}. If unclear, choose "Unsatisfied" only when there is any complaint.`,
      transcript,
      { temperature: 0, maxTokens: 30 },
    );
    return r.rating === "Satisfied" ? "Satisfied" : "Unsatisfied";
  } catch (e) {
    if (!(e instanceof ConfigError)) console.warn("classifyFeedback: AI failed, using rules", e);
    return guessFeedback(transcript);
  }
}
