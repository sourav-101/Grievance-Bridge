import { NextResponse } from "next/server";
import { z } from "zod";
import { speechText } from "@/lib/ai/speech";
import { getZone } from "@/lib/campus";
import { GRIEVANCE_CATEGORIES, GRIEVANCE_CATEGORY_IDS } from "@/lib/constants";
import type { GrievanceDraftPayload } from "@/lib/grievances/drafts";
import { detectEmergencyKeywords } from "@/lib/grievances/emergency";
import { createGrievance, listWorkerTickets, receiptSpeech, toWorkerView } from "@/lib/grievances/tickets";
import { receiptSpeechEn } from "@/lib/grievances/ticket-speech";
import { PhotoError, handleRouteError, jsonError, msgFor, readPhoto } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireWorker } from "@/lib/auth/session";
import { verifyPayload } from "@/lib/auth/session-token";
import { DraftAlreadyUsedError, consumeDraftAudio, promoteDraftAudio, removePhotos, uploadPhoto } from "@/lib/supabase/admin";
import { resolveDialect } from "@/lib/worker-context";
import type { GrievanceCategory } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Category = z.enum(GRIEVANCE_CATEGORY_IDS as [GrievanceCategory, ...GrievanceCategory[]]);
const ZoneId = z.string().refine((z) => !!getZone(z), "unknown zone");

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("draft"),
    draftToken: z.string().min(20),
    isAnonymous: z.boolean(),
    dialect: z.string().optional(),
    category: Category.optional(),
    zoneId: ZoneId.nullable().optional(),
  }),
  z.object({
    mode: z.literal("tap"),
    category: Category,
    zoneId: ZoneId,
    isAnonymous: z.boolean(),
    dialect: z.string().optional(),
  }),
]);

/**
 * File a grievance — either a confirmed voice draft or an icon-tap complaint.
 * JSON body, or multipart { payload: <same JSON>, photo?: image } when a photo is attached.
 */
export async function POST(req: Request) {
  // Set once the photo is in storage; removed again if the complaint is not saved.
  let photoPath: string | null = null;
  let saved = false;
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    const { workerId } = auth;
    if (!rateLimit(`grievance:${workerId}`, 10, 60 * 60 * 1000)) {
      return jsonError("एक घंटे में बहुत सारी शिकायतें। कृपया बाद में कोशिश करें।", 429);
    }
    let raw: unknown;
    let photo: Awaited<ReturnType<typeof readPhoto>> = null;
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      raw = JSON.parse(String(form.get("payload") || "{}"));
      photo = await readPhoto(form);
    } else {
      raw = await req.json();
    }
    const body = Body.parse(raw);
    // Upload before a voice draft is consumed, so a failed upload leaves the draft usable.
    if (photo) photoPath = await uploadPhoto(photo);

    let input: Parameters<typeof createGrievance>[0];
    if (body.mode === "draft") {
      const draft = await verifyPayload<GrievanceDraftPayload>(body.draftToken, "grievance-draft");
      if (!draft || draft.wid !== workerId) return jsonError("यह शिकायत पुरानी हो गई है। कृपया फिर से बोलें।", 410);

      // Whistleblower protection: a voice can identify a person, so anonymous
      // tickets keep only the text transcript — the recording is deleted.
      // The draft recording is consumed here, so the same draft can only be filed once
      // (e.g. pressing Back and submitting again).
      let audioPath: string | null = null;
      try {
        if (body.isAnonymous) await consumeDraftAudio(draft.audioPath);
        else audioPath = await promoteDraftAudio(draft.audioPath);
      } catch (e) {
        if (e instanceof DraftAlreadyUsedError) {
          return jsonError(
            msgFor(req)("यह शिकायत पहले ही दर्ज हो चुकी है। अपना टोकन 'मेरा इतिहास' में देखें।", "This complaint is already registered. See your token in 'My history'."),
            409,
          );
        }
        throw e;
      }

      const zoneId = body.zoneId !== undefined ? body.zoneId : draft.zoneId;
      input = {
        workerId,
        isAnonymous: body.isAnonymous,
        category: body.category ?? draft.category,
        zoneId,
        locationText: getZone(zoneId)?.nameEn ?? draft.locationText,
        transcriptHindi: draft.transcript,
        summaryEnglish: draft.summaryEnglish,
        audioPath,
        photoPath,
        isEmergency: draft.isEmergency,
        emergencyKeywords: draft.emergencyKeywords,
        dialect: draft.dialect,
        source: "voice",
      };
    } else {
      const zone = getZone(body.zoneId)!;
      const cat = GRIEVANCE_CATEGORIES[body.category];
      const transcript = `${cat.labelHi} की समस्या — ${zone.nameHi} (बटन से दर्ज, आवाज़ नहीं)`;
      const keywords = detectEmergencyKeywords(transcript);
      input = {
        workerId,
        isAnonymous: body.isAnonymous,
        category: body.category,
        zoneId: zone.id,
        locationText: zone.nameEn,
        transcriptHindi: transcript,
        summaryEnglish: `${body.category} issue reported at ${zone.nameEn} (filed by icon tap; no voice description).`,
        audioPath: null,
        photoPath,
        isEmergency: keywords.length > 0,
        emergencyKeywords: keywords,
        dialect: await resolveDialect(null, workerId),
        source: "tap",
      };
    }

    const { grievance, duplicateOf } = await createGrievance(input);
    saved = true;
    const view = toWorkerView(grievance, false);
    // Receipt is spoken in the language the worker is using now.
    const speakIn = await resolveDialect(body.dialect, workerId);
    const speech = await speechText(
      speakIn === "english"
        ? receiptSpeechEn(view.token, GRIEVANCE_CATEGORIES[view.category].labelEn, view.locationEn, view.isAnonymous, view.isEmergency)
        : receiptSpeech(view.token, GRIEVANCE_CATEGORIES[view.category].labelHi, view.location, view.isAnonymous, view.isEmergency),
      speakIn,
    );
    return NextResponse.json({ ticket: view, duplicateOf, speech });
  } catch (err) {
    if (photoPath && !saved) void removePhotos([photoPath]);
    if (err instanceof PhotoError) {
      const m = msgFor(req);
      return err.reason === "too_large"
        ? jsonError(m("फोटो बहुत बड़ी है। कोई दूसरी फोटो चुनें।", "The photo is too large. Choose another photo."), 413)
        : jsonError(m("यह फोटो नहीं खुल रही। JPG या PNG फोटो चुनें।", "This photo cannot be opened. Choose a JPG or PNG photo."), 415);
    }
    if (err instanceof SyntaxError) return jsonError("Invalid request", 400);
    return handleRouteError(err, "grievances:create");
  }
}

/** "My History": all of this worker's tickets, including anonymous ones. */
export async function GET() {
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ tickets: await listWorkerTickets(auth.workerId) });
  } catch (err) {
    return handleRouteError(err, "grievances:list");
  }
}
