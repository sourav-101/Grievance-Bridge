import { NextResponse } from "next/server";
import { z } from "zod";
import { groqJson } from "@/lib/ai/groq";
import { answerInformationQuery } from "@/lib/ai/rag";
import { speechToText } from "@/lib/ai/sarvam";
import { adaptToDialect } from "@/lib/ai/speech";
import { ALLOWED_ACTIONS, SITE_MAP, ruleBasedAnswer, sanitizeActions, type AssistantAction } from "@/lib/ai/assistant-rules";
import { DIALECTS, isSiteLanguage } from "@/lib/constants";
import { isConfigured } from "@/lib/env";
import { AudioTooLargeError, handleRouteError, jsonError, readAudio } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getWorkerSession } from "@/lib/auth/session";
import type { Dialect } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Turn = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1500) });
const Body = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(Turn).max(10).default([]),
  dialect: z.string().optional(),
  path: z.string().max(100).optional(),
});

const SYSTEM = (dialect: Dialect) => `You are "सहायक", the help assistant inside a website for contract workers (sanitation, gardening, construction, security, maintenance) at IIT Roorkee. Many users have low literacy.
Your job: help them use the website and find the right page, and answer simple questions.
${SITE_MAP}
Rules:
- Reply in very simple ${DIALECTS[dialect].promptName}${dialect === "english" ? "" : " written in Devanagari"}. Maximum 3 short sentences. No markdown, no lists${dialect === "english" ? "" : ", no English words unless they are names"}.
- Tell them exactly which button to press, using the button names above. Never write page addresses like "/grievance" in the reply; links go only in "actions".${dialect === "english" ? `
- The website is currently shown in ENGLISH, so call the buttons by their English names: "File a complaint" (red box with the microphone), "My complaints" / "My history", "Status by token", "Emergency", "Help", "Anonymous complaint" switch, "Listen", and the "अ/A" language button.` : ""}
- If they describe a problem at work (unpaid wages, injury, no water, harassment…), tell them to file a complaint and suggest "/grievance". If it is dangerous right now, suggest "#emergency" first.
- If they ask for facts about schemes, wages, health camps or documents, set "intent" to "information".
- Never invent phone numbers, amounts or dates.
Respond as JSON: {"intent": "navigate" | "information" | "emergency" | "other", "reply": "<reply>", "actions": ["<href from: ${Object.keys(ALLOWED_ACTIONS).join(", ")}>"]}`;

/**
 * Website help chatbot. JSON { message, history, dialect, path } or multipart
 * { audio, history (JSON), dialect, path } for spoken questions.
 * Works before login (navigation/PIN help) with a tighter rate limit.
 */
export async function POST(req: Request) {
  try {
    const session = await getWorkerSession();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = session ? `assistant:${session.phone}` : `assistant-ip:${ip}`;
    if (!rateLimit(key, session ? 40 : 15, 10 * 60_000)) return jsonError("कृपया थोड़ी देर बाद फिर पूछें।", 429);

    let raw: unknown;
    let transcript: string | null = null;
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = await readAudio(form);
      if (!audio) return jsonError("आवाज़ रिकॉर्ड नहीं हुई।");
      const english = form.get("dialect") === "english";
      transcript = (await speechToText(audio, { languageCode: english ? "en-IN" : "hi-IN" })).transcript;
      if (!transcript) {
        const reply = english
          ? "Sorry, I could not hear you clearly. Please speak again or type."
          : "माफ़ कीजिए, आवाज़ साफ़ नहीं आई। कृपया फिर से बोलें या लिखें।";
        return NextResponse.json({ transcript: "", reply, actions: [], speech: null });
      }
      let history: unknown = [];
      try {
        history = JSON.parse(String(form.get("history") || "[]"));
      } catch {
        // A malformed history field should not break the answer.
      }
      raw = {
        message: transcript.slice(0, 500),
        history,
        dialect: form.get("dialect") ?? undefined,
        path: form.get("path") ?? undefined,
      };
    } else {
      raw = await req.json();
    }
    const body = Body.parse(raw);
    const dialect: Dialect = isSiteLanguage(body.dialect) ? body.dialect : "hindi";
    const lang = dialect === "english" ? "en" : "hi";

    let reply: string;
    let actions: AssistantAction[];
    let source: "ai" | "rules" | "knowledge" = "ai";

    if (!isConfigured("GROQ_API_KEY")) {
      ({ reply, actions } = ruleBasedAnswer(body.message, lang));
      source = "rules";
    } else {
      try {
        const convo = body.history.map((t) => `${t.role === "user" ? "WORKER" : "ASSISTANT"}: ${t.text}`).join("\n");
        const r = await groqJson<{ intent?: string; reply?: string; actions?: unknown }>(
          SYSTEM(dialect),
          `${convo ? `CONVERSATION SO FAR:\n${convo}\n\n` : ""}CURRENT PAGE: ${body.path ?? "/"}\nWORKER: ${body.message}`,
          { temperature: 0.2, maxTokens: 400 },
        );
        reply = (r.reply || "").trim();
        actions = sanitizeActions(r.actions, lang);

        // Factual questions from logged-in workers → answer from the knowledge base / web.
        if (r.intent === "information" && session?.workerId) {
          try {
            const ans = await answerInformationQuery(body.message);
            if (ans.source !== "none") {
              reply = dialect === "english" ? await adaptToDialect(ans.answer, "english") : ans.answer;
              source = "knowledge";
            }
          } catch (e) {
            console.warn("assistant: knowledge lookup failed", e);
          }
        }
        if (!reply) ({ reply, actions } = ruleBasedAnswer(body.message, lang));
      } catch (e) {
        console.warn("assistant: AI failed, using rules", e);
        ({ reply, actions } = ruleBasedAnswer(body.message, lang));
        source = "rules";
      }
    }

    // The reply text goes back at once; the chat fetches its voice separately (/api/tts),
    // so the worker is not kept waiting ~3 s for speech synthesis before seeing the answer.
    return NextResponse.json({ transcript, reply, actions, source, speech: null });
  } catch (err) {
    if (err instanceof AudioTooLargeError) return jsonError("रिकॉर्डिंग बहुत लंबी है।", 413);
    return handleRouteError(err, "assistant");
  }
}
