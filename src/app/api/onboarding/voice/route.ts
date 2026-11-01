import { NextResponse } from "next/server";
import { extractNameAndAge } from "@/lib/ai/classifier";
import { speechToText } from "@/lib/ai/sarvam";
import { AudioTooLargeError, handleRouteError, jsonError, readAudio } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireVerifiedPhone } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Voice-assisted sign-up: "अपना नाम और उम्र बोलें" → { fullName, age } to pre-fill the form. */
export async function POST(req: Request) {
  try {
    const session = await requireVerifiedPhone();
    if (session instanceof NextResponse) return session;
    if (!rateLimit(`onboard:${session.phone}`, 10, 10 * 60_000)) return jsonError("कृपया थोड़ा रुककर कोशिश करें।", 429);

    const form = await req.formData();
    const audio = await readAudio(form);
    if (!audio) return jsonError("आवाज़ रिकॉर्ड नहीं हुई।");
    const { transcript } = await speechToText(audio, { languageCode: form.get("dialect") === "english" ? "en-IN" : "hi-IN" });
    if (!transcript) return NextResponse.json({ transcript: "", fullName: "", age: null });
    const { fullName, age } = await extractNameAndAge(transcript);
    return NextResponse.json({ transcript, fullName, age });
  } catch (err) {
    if (err instanceof AudioTooLargeError) return jsonError("रिकॉर्डिंग बहुत लंबी है।", 413);
    return handleRouteError(err, "onboarding:voice");
  }
}
