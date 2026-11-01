import { NextResponse } from "next/server";
import { speechText } from "@/lib/ai/speech";
import { lookupTicketByToken, statusSpeech } from "@/lib/grievances/tickets";
import { handleRouteError, jsonError } from "@/lib/http";
import { spokenFor } from "@/lib/i18n/prompts";
import { rateLimit } from "@/lib/rate-limit";
import { requireWorker } from "@/lib/auth/session";
import { extractTicketToken } from "@/lib/text";
import { resolveDialect } from "@/lib/worker-context";

export const runtime = "nodejs";

/** GET /api/tickets/status?token=4821[&speak=1] */
export async function GET(req: Request) {
  try {
    const auth = await requireWorker();
    if (auth instanceof NextResponse) return auth;
    // Throttle token guessing.
    if (!rateLimit(`status:${auth.workerId}`, 30, 10 * 60_000)) return jsonError("कृपया कुछ देर बाद कोशिश करें।", 429);

    const url = new URL(req.url);
    const token = extractTicketToken(url.searchParams.get("token") || "");
    if (!token) return jsonError("कृपया 4 अंकों का टोकन नंबर डालें।");
    const speak = url.searchParams.get("speak") === "1";
    const dialect = await resolveDialect(url.searchParams.get("dialect"), auth.workerId);

    const found = await lookupTicketByToken(token, auth.workerId);
    const speech = speak
      ? await speechText(found ? statusSpeech(found.view, dialect === "english") : spokenFor(dialect).ticketNotFound, dialect)
      : null;
    if (!found) return NextResponse.json({ ticket: null, token, speech }, { status: 404 });
    return NextResponse.json({ ticket: found.view, isOwner: found.isOwner, speech });
  } catch (err) {
    return handleRouteError(err, "tickets:status");
  }
}
