import { NextResponse } from "next/server";
import { z } from "zod";
import { synthesize } from "@/lib/ai/speech";
import { handleRouteError, jsonError } from "@/lib/http";
import { isPublicPromptKey, publicPrompt } from "@/lib/i18n/prompts";
import { rateLimit } from "@/lib/rate-limit";
import { getWorkerSession } from "@/lib/auth/session";
import { resolveDialect } from "@/lib/worker-context";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().trim().min(1).max(3000).optional(),
  promptKey: z.string().optional(),
  dialect: z.string().optional(),
  adapt: z.boolean().optional(),
});

/**
 * "Suno" playback. Free text requires a worker session (protects TTS credits);
 * fixed public prompts (login/onboarding instructions) do not.
 */
export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const session = await getWorkerSession();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    let text: string;
    if (body.promptKey) {
      if (!isPublicPromptKey(body.promptKey)) return jsonError("Unknown prompt");
      text = publicPrompt(body.promptKey, body.dialect === "english");
      if (!rateLimit(`tts-public:${ip}`, 30, 10 * 60_000)) return jsonError("Too many requests", 429);
    } else {
      if (!session) return jsonError("कृपया पहले लॉग इन करें।", 401);
      if (!body.text) return jsonError("text is required");
      if (!rateLimit(`tts:${session.phone}`, 40, 60_000)) return jsonError("कृपया थोड़ा रुककर कोशिश करें।", 429);
      text = body.text;
    }

    const dialect = await resolveDialect(body.dialect, session?.workerId ?? null);
    const speech = await synthesize(text, dialect, { adapt: body.adapt !== false });
    return NextResponse.json(speech);
  } catch (err) {
    return handleRouteError(err, "tts");
  }
}
