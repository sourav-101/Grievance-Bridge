import "server-only";
import { env } from "../env";
import { UpstreamError, fetchWithTimeout } from "../http";

export const EMBEDDING_DIM = 1536;

export function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/**
 * Gemini embeddings (gemini-embedding-001 by default), truncated to 1536 dims
 * via outputDimensionality and L2-normalised (required for non-3072 sizes).
 */
export async function embedText(text: string, kind: "query" | "document"): Promise<number[]> {
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const isV2 = model.includes("embedding-2");
  // gemini-embedding-2 uses task prefixes instead of taskType.
  const content = isV2 ? (kind === "query" ? `task: search result | query: ${text}` : `title: none | text: ${text}`) : text;

  const body: Record<string, unknown> = {
    model: `models/${model}`,
    content: { parts: [{ text: content.slice(0, 8000) }] },
    outputDimensionality: EMBEDDING_DIM,
  };
  if (!isV2) body.taskType = kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env("GEMINI_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    15000,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError("Embeddings", `Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as {
    embedding?: { values?: number[] };
    embeddings?: { values?: number[] }[];
  };
  const values = data.embedding?.values ?? data.embeddings?.[0]?.values;
  if (!values?.length) throw new UpstreamError("Embeddings", "Gemini returned no embedding values");
  if (values.length !== EMBEDDING_DIM) {
    throw new UpstreamError("Embeddings", `Expected ${EMBEDDING_DIM} dims, got ${values.length}`);
  }
  return l2normalize(values);
}

/** pgvector literal: "[0.1,0.2,…]" */
export const toPgVector = (v: number[]) => `[${v.join(",")}]`;
