import "server-only";
import { randomInt } from "node:crypto";
import { getZone } from "../campus";
import { DUPLICATE_WINDOW_DAYS } from "../constants";
import { isConfigured } from "../env";
import { groqJson } from "../ai/groq";
import { supabaseAdmin } from "../supabase/admin";
import { truncate } from "../text";
export { receiptSpeech, statusSpeech } from "./ticket-speech";
import type { Dialect, Grievance, GrievanceCategory, WorkerTicketView } from "../types";

// ----------------------------------------------------------------- tokens

/** Random, non-sequential 4-digit token (falls back to 5 digits if the space is crowded). */
export async function generateTicketToken(): Promise<string> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 20; attempt++) {
    const token = attempt < 15 ? String(randomInt(1000, 10000)) : String(randomInt(10000, 100000));
    const { data } = await db.from("grievances").select("id").eq("ticket_token", token).maybeSingle();
    if (!data) return token;
  }
  throw new Error("Could not allocate a ticket token");
}

// ----------------------------------------------------------------- duplicate clustering

interface DuplicateCandidate {
  id: string;
  ticket_token: string;
  summary_english: string;
  transcript_hindi: string;
}

/**
 * AI duplicate clustering: among OPEN master tickets from the last N days with
 * the same category and zone, ask the LLM whether the new report describes the
 * same issue. Returns the master ticket id, or null.
 */
export async function findDuplicateParent(input: {
  category: GrievanceCategory;
  zoneId: string | null;
  summaryEnglish: string;
  transcriptHindi: string;
}): Promise<DuplicateCandidate | null> {
  if (!input.zoneId || input.zoneId === "other" || !isConfigured("GROQ_API_KEY")) return null;
  // Personal grievances (wages, harassment) are about individuals — never merge them.
  if (input.category === "Wage Dispute" || input.category === "Harassment") return null;

  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86400_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("grievances")
    .select("id, ticket_token, summary_english, transcript_hindi")
    .eq("category", input.category)
    .eq("campus_zone", input.zoneId)
    .is("parent_ticket_id", null)
    .neq("status", "Resolved")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8);
  const candidates = (data ?? []) as DuplicateCandidate[];
  if (!candidates.length) return null;

  try {
    const r = await groqJson<{ duplicate_of?: string | null }>(
      `You deduplicate maintenance complaints on a university campus. A new complaint is a duplicate only if it reports
the SAME physical problem at the SAME place (e.g. "no water in Govind Bhawan" twice). Different problems at the same place are NOT duplicates.
Return JSON {"duplicate_of": "<candidate id>"} or {"duplicate_of": null}.`,
      `NEW COMPLAINT:\nEnglish: ${input.summaryEnglish}\nHindi: ${input.transcriptHindi}\n\nOPEN COMPLAINTS:\n` +
        candidates.map((c) => `id=${c.id}\nEnglish: ${c.summary_english}\nHindi: ${truncate(c.transcript_hindi, 300)}`).join("\n---\n"),
      { temperature: 0, maxTokens: 80 },
    );
    return candidates.find((c) => c.id === r.duplicate_of) ?? null;
  } catch (e) {
    console.warn("Duplicate check failed; filing as new ticket", e);
    return null;
  }
}

// ----------------------------------------------------------------- create

export interface NewGrievanceInput {
  workerId: string;
  isAnonymous: boolean;
  category: GrievanceCategory;
  zoneId: string | null;
  locationText: string;
  transcriptHindi: string;
  summaryEnglish: string;
  audioPath: string | null;
  /** Optional photo already uploaded to the photo vault. */
  photoPath?: string | null;
  isEmergency: boolean;
  emergencyKeywords: string[];
  dialect: Dialect;
  source: "voice" | "tap";
}

export async function createGrievance(input: NewGrievanceInput): Promise<{ grievance: Grievance; duplicateOf: string | null }> {
  const db = supabaseAdmin();

  const { data: worker } = await db.from("workers").select("contractor_id").eq("id", input.workerId).maybeSingle();
  const zone = getZone(input.zoneId);
  const token = await generateTicketToken();
  const parent = input.isEmergency
    ? null // emergencies always stay visible as their own ticket
    : await findDuplicateParent({
        category: input.category,
        zoneId: input.zoneId,
        summaryEnglish: input.summaryEnglish,
        transcriptHindi: input.transcriptHindi,
      });

  const { data, error } = await db
    .from("grievances")
    .insert({
      ticket_token: token,
      worker_id: input.isAnonymous ? null : input.workerId,
      contractor_id: worker?.contractor_id ?? null,
      category: input.category,
      campus_location: truncate(zone ? zone.nameEn : input.locationText || "Not specified", 100),
      campus_zone: zone?.id ?? null,
      latitude: zone?.lat ?? null,
      longitude: zone?.lng ?? null,
      raw_audio_url: input.audioPath,
      // Only sent when there is a photo, so filing still works before migration 0004 is run.
      ...(input.photoPath ? { photo_url: input.photoPath } : {}),
      transcript_hindi: input.transcriptHindi,
      summary_english: input.summaryEnglish || `${input.category} complaint (no summary available).`,
      is_anonymous: input.isAnonymous,
      is_emergency: input.isEmergency,
      emergency_keywords: input.emergencyKeywords,
      parent_ticket_id: parent?.id ?? null,
      dialect: input.dialect,
      source: input.source,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not save grievance: ${error?.message}`);
  const grievance = data as Grievance;

  if (input.isAnonymous) {
    const { error: ownErr } = await db.from("grievance_owners").insert({ grievance_id: grievance.id, worker_id: input.workerId });
    if (ownErr) console.error("grievance_owners insert failed", ownErr.message);
  }

  await db.from("grievance_events").insert({
    grievance_id: grievance.id,
    actor_label: "System",
    to_status: "New",
    note: [
      `Filed by ${input.isAnonymous ? "anonymous worker" : "worker"} via ${input.source}.`,
      input.photoPath ? "Photo attached." : "",
      input.isEmergency ? `EMERGENCY flag${input.emergencyKeywords.length ? ` (keywords: ${input.emergencyKeywords.join(", ")})` : ""}.` : "",
      parent ? `Auto-clustered as duplicate of ticket #${parent.ticket_token}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  return { grievance, duplicateOf: parent?.ticket_token ?? null };
}

// ----------------------------------------------------------------- worker views

export function toWorkerView(g: Grievance, feedbackGiven: boolean): WorkerTicketView {
  const zone = getZone(g.campus_zone);
  return {
    id: g.id,
    token: g.ticket_token,
    category: g.category,
    location: zone?.nameHi ?? g.campus_location,
    locationEn: zone?.nameEn ?? g.campus_location,
    status: g.status,
    isAnonymous: g.is_anonymous,
    isEmergency: g.is_emergency,
    summaryHindi: truncate(g.transcript_hindi, 220),
    resolutionNoteHindi: g.resolution_note_hindi,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    resolvedAt: g.resolved_at,
    feedbackGiven,
    hasPhoto: Boolean(g.photo_url),
  };
}

/** All tickets visible to this worker: named tickets + their anonymous ones. */
export async function listWorkerTickets(workerId: string): Promise<WorkerTicketView[]> {
  const db = supabaseAdmin();
  // Feedback is embedded in the same query (one round trip fewer per page load).
  type Row = Grievance & { feedback?: { id: string } | { id: string }[] | null };
  const WITH_FEEDBACK = "*, feedback(id)";
  const [{ data: named }, { data: owned }] = await Promise.all([
    db.from("grievances").select(WITH_FEEDBACK).eq("worker_id", workerId),
    db.from("grievance_owners").select("grievance_id").eq("worker_id", workerId),
  ]);
  let anonymous: Row[] = [];
  const ownedIds = (owned ?? []).map((o: { grievance_id: string }) => o.grievance_id);
  if (ownedIds.length) {
    const { data } = await db.from("grievances").select(WITH_FEEDBACK).in("id", ownedIds);
    anonymous = (data ?? []) as Row[];
  }
  const hasFeedback = (r: Row) => (Array.isArray(r.feedback) ? r.feedback.length > 0 : Boolean(r.feedback));
  return [...((named ?? []) as Row[]), ...anonymous]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((g) => toWorkerView(g, hasFeedback(g)));
}

/** Does this worker own this ticket (named or anonymous)? */
export async function workerOwnsTicket(workerId: string, grievanceId: string): Promise<Grievance | null> {
  const db = supabaseAdmin();
  const { data: g } = await db.from("grievances").select("*").eq("id", grievanceId).maybeSingle();
  if (!g) return null;
  if ((g as Grievance).worker_id === workerId) return g as Grievance;
  const { data: own } = await db
    .from("grievance_owners")
    .select("worker_id")
    .eq("grievance_id", grievanceId)
    .eq("worker_id", workerId)
    .maybeSingle();
  return own ? (g as Grievance) : null;
}

/**
 * Token lookup for the status search. Owners get the full view; other logged-in
 * workers only learn category + status (no location, transcript or notes).
 */
export async function lookupTicketByToken(
  token: string,
  workerId: string,
): Promise<{ view: WorkerTicketView; isOwner: boolean } | null> {
  const db = supabaseAdmin();
  const { data } = await db.from("grievances").select("*").eq("ticket_token", token).maybeSingle();
  if (!data) return null;
  const g = data as Grievance;
  const owned = await workerOwnsTicket(workerId, g.id);
  const { data: fb } = await db.from("feedback").select("id").eq("grievance_id", g.id).maybeSingle();
  const full = toWorkerView(g, Boolean(fb));
  if (owned) return { view: full, isOwner: true };
  return {
    isOwner: false,
    view: { ...full, location: "—", locationEn: "—", summaryHindi: "", resolutionNoteHindi: null, isAnonymous: false, feedbackGiven: true },
  };
}
