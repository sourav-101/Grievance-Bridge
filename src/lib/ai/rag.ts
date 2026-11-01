import "server-only";
import { ConfigError, envNumber, isConfigured } from "../env";
import { truncate } from "../text";
import { supabaseAdmin } from "../supabase/admin";
import { embedText, toPgVector } from "./embeddings";
import { groqJson } from "./groq";
import { webSearch } from "./tavily";

export interface AnswerReference {
  title: string;
  url?: string;
}

export interface AnswerResult {
  title: string;
  answer: string;
  source: "rag" | "web" | "none";
  /** Top cosine similarity from the knowledge base (null if retrieval was skipped). */
  confidence: number | null;
  references: AnswerReference[];
}

interface KbMatch {
  id: string;
  title: string;
  category: string;
  content_hindi: string;
  similarity: number;
}

const ANSWER_SYSTEM = `You are "Sahayak", a friendly voice assistant for contract workers (sanitation, horticulture, construction, security, maintenance) at IIT Roorkee.
Many users have low literacy. Your answer will be READ ALOUD.
Rules:
- Reply in simple, warm, everyday Hindi in Devanagari script. Maximum 3 short sentences. No markdown, no lists, no URLs, no emojis.
- Use ONLY facts from the CONTEXT. Never invent amounts, dates, phone numbers or eligibility rules.
- If the context contains "[PLACEHOLDER" for the needed fact, say that the Estate Office will update this information soon.
- If the context does not answer the question, say so honestly and suggest asking at the Estate Office or using the complaint (शिकायत) button.
Respond as JSON: {"title": "<2-5 word Hindi title>", "answer": "<Hindi answer>", "answered": <true if the CONTEXT contained the answer, else false>}`;

async function retrieve(query: string): Promise<KbMatch[]> {
  const vector = await embedText(query, "query");
  const { data, error } = await supabaseAdmin().rpc("match_knowledge", {
    query_embedding: toPgVector(vector),
    match_count: 3,
  });
  if (error) throw new Error(`match_knowledge failed: ${error.message}`);
  return (data ?? []) as KbMatch[];
}

/**
 * Information query pipeline:
 *   vector search (pgvector) → if top similarity < threshold → Tavily live web search
 *   → Groq writes a short spoken Hindi answer grounded in the chosen context.
 */
export async function answerInformationQuery(question: string, searchQuery?: string): Promise<AnswerResult> {
  const threshold = envNumber("RAG_CONFIDENCE_THRESHOLD", 0.7);
  const query = (searchQuery || question).trim();

  let matches: KbMatch[] = [];
  if (isConfigured("GEMINI_API_KEY")) {
    try {
      matches = await retrieve(query);
    } catch (e) {
      console.warn("RAG retrieval failed; continuing with web fallback", e);
    }
  }
  const confidence = matches[0]?.similarity ?? null;

  let context = "";
  let source: AnswerResult["source"] = "none";
  let references: AnswerReference[] = [];

  if (confidence !== null && confidence >= threshold) {
    const used = matches.filter((m) => m.similarity >= threshold - 0.08);
    context = used.map((m) => `### ${m.title}\n${m.content_hindi}`).join("\n\n");
    source = "rag";
    references = used.map((m) => ({ title: m.title }));
  } else if (isConfigured("TAVILY_API_KEY")) {
    try {
      const web = await webSearch(`${query} India labour scheme Uttarakhand`);
      if (web.results.length || web.answer) {
        context = [
          web.answer ? `Summary: ${web.answer}` : "",
          ...web.results.map((r) => `### ${r.title} (${r.url})\n${r.content}`),
        ]
          .filter(Boolean)
          .join("\n\n");
        source = "web";
        references = web.results.slice(0, 3).map((r) => ({ title: r.title, url: r.url }));
      }
    } catch (e) {
      console.warn("Web search failed", e);
    }
  }
  // Last resort: low-confidence local matches are still better than nothing.
  if (!context && matches.length) {
    context = matches.map((m) => `### ${m.title}\n${m.content_hindi}`).join("\n\n");
    source = "rag";
    references = matches.map((m) => ({ title: m.title }));
  }

  let result: { title?: string; answer?: string; answered?: boolean };
  try {
    result = await groqJson<{ title?: string; answer?: string; answered?: boolean }>(
      ANSWER_SYSTEM,
      `QUESTION (worker's words): ${question}\n\nCONTEXT:\n${context || "(no information found)"}`,
      { temperature: 0.2, maxTokens: 500, effort: "low" },
    );
  } catch (e) {
    // AI unavailable: read out the best knowledge-base entry as it is (already Hindi).
    if (!(e instanceof ConfigError)) console.warn("RAG answer: AI failed, using top match", e);
    const top = confidence !== null && confidence >= threshold ? matches[0] : undefined;
    result = top ? { title: top.title, answer: truncate(top.content_hindi, 450) } : {};
    if (!top) {
      context = "";
      references = [];
    }
  }

  return {
    title: (result.title || "जानकारी").slice(0, 60),
    answer:
      result.answer?.trim() ||
      "माफ़ कीजिए, अभी मेरे पास इसकी पक्की जानकारी नहीं है। कृपया एस्टेट ऑफिस से पूछें या शिकायत बटन दबाएं।",
    // "none" when nothing relevant was found, so callers can fall back to their own reply.
    source: context && result.answered !== false ? source : "none",
    confidence,
    references,
  };
}
