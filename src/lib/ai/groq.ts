import "server-only";
import { env } from "../env";
import { UpstreamError, fetchWithTimeout } from "../http";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/** Used when GROQ_MODEL is unset, and as a retry when the configured model has been retired. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Second model with its own (separate) Groq quota. Used automatically when the main
 * model is rate-limited (per-minute or daily), times out, errors, or returns broken
 * JSON — so the AI keeps answering instead of falling back to keyword rules.
 * Set GROQ_FALLBACK_MODEL to change it, or to "none" to switch this off.
 */
export const DEFAULT_GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b";

/** Extra tokens for models that reason before answering; their reasoning counts against max_tokens. */
const REASONING_HEADROOM = 1000;

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  /** Thinking effort for reasoning models: "low" for simple rewriting, "medium" (default) for understanding. */
  effort?: "low" | "medium";
  timeoutMs?: number;
}

const isReasoningModel = (model: string) => /gpt-oss|qwen3|deepseek-r1/i.test(model);

function requestBody(model: string, system: string, user: string, opts: ChatOptions) {
  const maxTokens = opts.maxTokens ?? 700;
  const reasoning = isReasoningModel(model);
  return JSON.stringify({
    model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: reasoning ? maxTokens + REASONING_HEADROOM : maxTokens,
    // "low" misjudged intent in testing, so understanding uses "medium"; plain rewriting can ask for "low".
    ...(reasoning && /gpt-oss/i.test(model) ? { reasoning_effort: opts.effort ?? "medium" } : {}),
    // Qwen: keep its thinking out of the answer (also ~5x faster to the first word).
    ...(/qwen3/i.test(model) ? { reasoning_format: "hidden" } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
}

/** Seconds Groq asks us to wait: Retry-After header, or "try again in 7.3s / 2m30s / 1h5m0s". */
function retryAfterSeconds(res: Response, detail: string): number {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  const m = detail.match(/try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]) : 60;
}

/** While the main model is rate-limited, go straight to the backup (no wasted request each time). */
let primaryPausedUntil = 0;

async function chat(system: string, user: string, opts: ChatOptions = {}): Promise<string> {
  const configured = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const fallbackSetting = process.env.GROQ_FALLBACK_MODEL?.trim() || DEFAULT_GROQ_FALLBACK_MODEL;
  const backup = fallbackSetting.toLowerCase() === "none" || fallbackSetting === configured ? null : fallbackSetting;

  const send = (model: string) =>
    fetchWithTimeout(
      ENDPOINT,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env("GROQ_API_KEY")}`, "Content-Type": "application/json" },
        body: requestBody(model, system, user, opts),
      },
      opts.timeoutMs ?? 20000,
    );

  /** Try the main model; returns null when the backup should be used instead. */
  const tryPrimary = async (): Promise<Response | null> => {
    if (backup && Date.now() < primaryPausedUntil) return null;
    let res: Response;
    try {
      res = await send(configured);
    } catch (e) {
      if (!backup) throw e;
      console.warn(`[groq] ${configured} did not answer (${(e as Error).name}); using ${backup}.`);
      return null;
    }
    // Groq retires models from time to time; keep working on the default instead of failing.
    if (res.status === 404 && configured !== DEFAULT_GROQ_MODEL) {
      const detail = await res.clone().text().catch(() => "");
      if (/model_not_found|does not exist|decommissioned/i.test(detail)) {
        console.warn(`[groq] model "${configured}" is not available; using ${DEFAULT_GROQ_MODEL}. Update GROQ_MODEL in .env.local.`);
        res = await send(DEFAULT_GROQ_MODEL);
      }
    }
    if (res.ok || !backup) return res;

    const detail = await res.clone().text().catch(() => "");
    if (res.status === 429) {
      const wait = retryAfterSeconds(res, detail);
      primaryPausedUntil = Date.now() + wait * 1000;
      const daily = /\((TPD|RPD)\)/.test(detail);
      console.warn(`[groq] ${configured} ${daily ? "daily" : "per-minute"} limit reached; using ${backup} for ~${Math.ceil(wait)} s.`);
      return null;
    }
    if (res.status >= 500 || /json_validate_failed|Failed to (validate|generate) JSON/i.test(detail)) {
      console.warn(`[groq] ${configured} failed (${res.status}); retrying this request on ${backup}.`);
      return null;
    }
    return res; // other errors (bad key, bad request) are real problems: report them
  };

  const res = (await tryPrimary()) ?? (await send(backup!));
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError("AI", `Groq ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  // Safety net in case a reasoning model ever leaks its thinking into the answer.
  return (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export async function groqText(system: string, user: string, opts: Omit<ChatOptions, "json"> = {}): Promise<string> {
  return chat(system, user, opts);
}

/** Chat completion in JSON mode. The system prompt must mention JSON. */
export async function groqJson<T>(system: string, user: string, opts: Omit<ChatOptions, "json"> = {}): Promise<T> {
  const raw = await chat(system, user, { ...opts, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fallback: extract the first {...} block.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new UpstreamError("AI", `Groq returned non-JSON: ${raw.slice(0, 200)}`);
  }
}
