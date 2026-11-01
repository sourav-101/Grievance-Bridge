import { NextResponse } from "next/server";
import { classifyUtterance } from "@/lib/ai/classifier";
import { answerInformationQuery } from "@/lib/ai/rag";
import { speechToText } from "@/lib/ai/sarvam";
import { speechText } from "@/lib/ai/speech";
import { getZone, sttKeyterms } from "@/lib/campus";
import { GRIEVANCE_CATEGORIES } from "@/lib/constants";
import { lookupTicketByToken, statusSpeech } from "@/lib/grievances/tickets";
import { AudioTooLargeError, handleRouteError, jsonError, readAudio } from "@/lib/http";
import { spokenFor } from "@/lib/i18n/prompts";
import { rateLimit } from "@/lib/rate-limit";
import { requireWorker } from "@/lib/auth/session";
import { signPayload } from "@/lib/auth/session-token";
import { uploadAudio } from "@/lib/supabase/admin";
import { logVoiceQuery, resolveDialect } from "@/lib/worker-context";
import type { GrievanceDraftPayload } from "@/lib/grievances/drafts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Main voice pipeline:
 *   audio → Sarvam STT → campus auto-correct → Groq intent classifier →
 *     information  → RAG / Tavily → spoken answer
 *     grievance    → signed draft (worker confirms + chooses anonymity) → /api/grievances
 *     status_check → ticket lookup → spoken status
 *   → Sarvam TTS (dialect-adapted) → dual output (card + audio)
 */
export async function POST(req: Request) {
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    const { workerId } = auth;
    if (!rateLimit(`voice:${workerId}`, 15, 60_000)) return jsonError("कृपया थोड़ा रुककर फिर से बोलें।", 429);

    const form = await req.formData();
    const audio = await readAudio(form);
    if (!audio) return jsonError("आवाज़ रिकॉर्ड नहीं हुई।");
    const dialect = await resolveDialect(form.get("dialect"), workerId);
    const context = form.get("context") === "grievance" ? "grievance" : "global";
    const english = dialect === "english";
    const SPOKEN = spokenFor(dialect);

    const { transcript } = await speechToText(audio, { keyterms: sttKeyterms(), languageCode: english ? "en-IN" : "hi-IN" });
    if (!transcript || transcript.length < 2) {
      return NextResponse.json({ type: "empty", transcript: "", speech: await speechText(SPOKEN.notHeard, dialect) });
    }

    const cls = await classifyUtterance(transcript, { forceGrievance: context === "grievance" });

    // ------------------------------------------------------------ information
    if (cls.intent === "information") {
      const ans = await answerInformationQuery(cls.correctedTranscript, cls.searchQuery);
      const speech = await speechText(ans.answer, dialect);
      void logVoiceQuery({
        workerId, transcript, correctedTranscript: cls.correctedTranscript, intent: "information",
        answerText: ans.answer, answerSource: ans.source, confidence: ans.confidence, dialect,
      });
      return NextResponse.json({
        type: "answer",
        transcript: cls.correctedTranscript,
        card: { title: ans.title, text: speech.text, source: ans.source, confidence: ans.confidence, references: ans.references },
        speech,
      });
    }

    // ------------------------------------------------------------ grievance → draft
    if (cls.intent === "grievance") {
      const audioPath = await uploadAudio("drafts", audio);
      const zone = getZone(cls.zoneId);
      const payload: GrievanceDraftPayload = {
        wid: workerId,
        audioPath,
        transcript: cls.correctedTranscript,
        rawTranscript: transcript,
        category: cls.category,
        zoneId: cls.zoneId,
        locationText: cls.locationText,
        summaryEnglish: cls.summaryEnglish || `${cls.category} complaint reported by a worker${zone ? ` at ${zone.nameEn}` : ""}.`,
        isEmergency: cls.isEmergency,
        emergencyKeywords: cls.emergencyKeywords,
        dialect,
      };
      const draftToken = await signPayload({ ...payload }, "grievance-draft", "30m");
      const where = english
        ? zone?.nameEn || cls.locationText || "place not given"
        : zone?.nameHi || cls.locationText || "जगह नहीं बताई";
      const text = (
        english
          ? [
              `I have understood your complaint. Subject: ${GRIEVANCE_CATEGORIES[cls.category].labelEn}. Place: ${where}.`,
              zone ? "" : "Please choose the place below.",
              "Press the green button to register the complaint. To hide your name, first turn on the anonymous switch.",
              cls.isEmergency ? "If someone is hurt, press the red emergency button and call right away." : "",
            ]
          : [
              `मैंने आपकी शिकायत समझ ली है। विषय: ${GRIEVANCE_CATEGORIES[cls.category].labelHi}। जगह: ${where}।`,
              zone ? "" : "कृपया नीचे से जगह चुनें।",
              "शिकायत दर्ज करने के लिए हरा बटन दबाएं। नाम छुपाना हो तो पहले गुमनाम बटन चालू करें।",
              cls.isEmergency ? "अगर किसी को चोट लगी है तो तुरंत लाल आपातकालीन बटन दबाकर फ़ोन करें।" : "",
            ]
      )
        .filter(Boolean)
        .join(" ");
      const speech = await speechText(text, dialect);
      void logVoiceQuery({ workerId, transcript, correctedTranscript: cls.correctedTranscript, intent: "grievance", answerSource: "grievance", dialect });
      return NextResponse.json({
        type: "grievance_draft",
        transcript: cls.correctedTranscript,
        draft: {
          token: draftToken,
          category: cls.category,
          zoneId: cls.zoneId,
          locationText: cls.locationText,
          isEmergency: cls.isEmergency,
        },
        speech,
      });
    }

    // ------------------------------------------------------------ status check
    if (cls.intent === "status_check") {
      if (!cls.ticketToken) {
        return NextResponse.json({ type: "status", transcript: cls.correctedTranscript, ticket: null, speech: await speechText(SPOKEN.askToken, dialect) });
      }
      const found = await lookupTicketByToken(cls.ticketToken, workerId);
      const text = found ? statusSpeech(found.view, english) : SPOKEN.ticketNotFound;
      const speech = await speechText(text, dialect);
      void logVoiceQuery({ workerId, transcript, correctedTranscript: cls.correctedTranscript, intent: "status_check", answerText: text, answerSource: "status", dialect });
      return NextResponse.json({ type: "status", transcript: cls.correctedTranscript, ticket: found?.view ?? null, isOwner: found?.isOwner ?? false, speech });
    }

    // ------------------------------------------------------------ other
    const speech = await speechText(SPOKEN.help, dialect);
    void logVoiceQuery({ workerId, transcript, correctedTranscript: cls.correctedTranscript, intent: "other", answerText: SPOKEN.help, answerSource: "none", dialect });
    return NextResponse.json({ type: "help", transcript: cls.correctedTranscript, speech });
  } catch (err) {
    if (err instanceof AudioTooLargeError) return jsonError("रिकॉर्डिंग बहुत लंबी है। 30 सेकंड से कम बोलें।", 413);
    return handleRouteError(err, "voice-agent");
  }
}
