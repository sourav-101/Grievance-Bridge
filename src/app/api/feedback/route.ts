import { NextResponse } from "next/server";
import { classifyFeedback } from "@/lib/ai/classifier";
import { speechToText } from "@/lib/ai/sarvam";
import { speechText } from "@/lib/ai/speech";
import { workerOwnsTicket } from "@/lib/grievances/tickets";
import { AudioTooLargeError, handleRouteError, jsonError, readAudio } from "@/lib/http";
import { spokenFor } from "@/lib/i18n/prompts";
import { requireWorker } from "@/lib/auth/session";
import { supabaseAdmin, uploadAudio } from "@/lib/supabase/admin";
import { resolveDialect } from "@/lib/worker-context";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Resolution feedback: multipart { grievanceId, rating?: Satisfied|Unsatisfied, audio?: ≤10 s }.
 * If only audio is sent, the rating is inferred from the spoken words.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    const form = await req.formData();
    const grievanceId = String(form.get("grievanceId") || "");
    const ratingRaw = form.get("rating");
    const audio = await readAudio(form);

    const g = await workerOwnsTicket(auth.workerId, grievanceId);
    if (!g) return jsonError("शिकायत नहीं मिली।", 404);
    if (g.status !== "Resolved") return jsonError("शिकायत हल होने के बाद ही राय दें।");

    let rating: "Satisfied" | "Unsatisfied" | null =
      ratingRaw === "Satisfied" || ratingRaw === "Unsatisfied" ? ratingRaw : null;
    let transcript: string | null = null;
    let audioPath: string | null = null;

    if (audio) {
      transcript = (await speechToText(audio)).transcript || null;
      if (!rating && transcript) rating = await classifyFeedback(transcript);
      // Anonymous tickets: keep the words, not the voice.
      if (!g.is_anonymous) audioPath = await uploadAudio("feedback", audio);
    }
    if (!rating) return jsonError("कृपया 👍 या 👎 दबाएं, या बोलकर बताएं।");

    const { error } = await supabaseAdmin()
      .from("feedback")
      .insert({
        grievance_id: g.id,
        worker_id: g.is_anonymous ? null : auth.workerId,
        rating,
        feedback_audio_url: audioPath,
        feedback_transcript: transcript,
      });
    if (error) {
      if (error.code === "23505") return jsonError("आप पहले ही राय दे चुके हैं।", 409);
      throw new Error(error.message);
    }
    const dialect = await resolveDialect(form.get("dialect"), auth.workerId);
    return NextResponse.json({ ok: true, rating, speech: await speechText(spokenFor(dialect).feedbackThanks, dialect) });
  } catch (err) {
    if (err instanceof AudioTooLargeError) return jsonError("रिकॉर्डिंग बहुत लंबी है।", 413);
    return handleRouteError(err, "feedback");
  }
}
