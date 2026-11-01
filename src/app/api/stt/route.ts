import { NextResponse } from "next/server";
import { speechToText } from "@/lib/ai/sarvam";
import { AudioTooLargeError, handleRouteError, jsonError, readAudio } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireWorker } from "@/lib/auth/session";
import { extractTicketToken } from "@/lib/text";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Plain transcription (used by the spoken ticket-token search). */
export async function POST(req: Request) {
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    if (!rateLimit(`stt:${auth.workerId}`, 20, 60_000)) return jsonError("कृपया थोड़ा रुककर कोशिश करें।", 429);
    const audio = await readAudio(await req.formData());
    if (!audio) return jsonError("आवाज़ रिकॉर्ड नहीं हुई।");
    const { transcript } = await speechToText(audio);
    return NextResponse.json({ transcript, token: extractTicketToken(transcript) });
  } catch (err) {
    if (err instanceof AudioTooLargeError) return jsonError("रिकॉर्डिंग बहुत लंबी है।", 413);
    return handleRouteError(err, "stt");
  }
}
