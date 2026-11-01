import "server-only";
import { env } from "../env";
import { UpstreamError, fetchWithTimeout } from "../http";

export interface WebResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface WebSearchResult {
  answer: string | null;
  results: WebResult[];
}

/** Live web search for government schemes / labour rules (Tavily). */
export async function webSearch(query: string): Promise<WebSearchResult> {
  const res = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env("TAVILY_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 4,
        // No include_answer: Groq writes the answer, and Tavily's summary adds 2–3 s.
        topic: "general",
        country: "india",
      }),
    },
    15000,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError("Web search", `Tavily ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as { answer?: string; results?: WebResult[] };
  return {
    answer: data.answer ?? null,
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: (r.content || "").slice(0, 800),
      score: r.score,
    })),
  };
}
