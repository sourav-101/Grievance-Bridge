import "server-only";
import { isSiteLanguage } from "./constants";
import { supabaseAdmin } from "./supabase/admin";
import type { Dialect } from "./types";

/** Site language (Hindi or English) from the request, else the worker's saved preference, else Hindi. */
export async function resolveDialect(requested: unknown, workerId: string | null): Promise<Dialect> {
  if (isSiteLanguage(requested)) return requested;
  if (!workerId) return "hindi";
  const { data } = await supabaseAdmin().from("workers").select("preferred_dialect").eq("id", workerId).maybeSingle();
  return isSiteLanguage(data?.preferred_dialect) ? data.preferred_dialect : "hindi";
}

/** Best-effort log of a voice interaction (never throws). */
export async function logVoiceQuery(row: {
  workerId: string;
  transcript: string;
  correctedTranscript?: string;
  intent: string;
  answerText?: string;
  answerSource?: string;
  confidence?: number | null;
  dialect: Dialect;
}): Promise<void> {
  try {
    await supabaseAdmin().from("voice_queries").insert({
      worker_id: row.workerId,
      transcript: row.transcript,
      corrected_transcript: row.correctedTranscript ?? null,
      intent: row.intent,
      answer_text: row.answerText ?? null,
      answer_source: row.answerSource ?? null,
      confidence: row.confidence ?? null,
      dialect: row.dialect,
    });
  } catch (e) {
    console.warn("voice_queries insert failed", e);
  }
}
