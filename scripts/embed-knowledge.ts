/**
 * Embed all knowledge_base rows that have no vector yet (run after seeding).
 *   npm run embed:knowledge
 * Reads .env.local. Uses the service-role key and Gemini embeddings directly
 * (no Next.js runtime needed).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"];
for (const k of required) {
  if (!process.env[k] || process.env[k]!.startsWith("YOUR_")) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

const DIM = 1536;
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function embed(text: string): Promise<number[]> {
  const isV2 = model.includes("embedding-2");
  const body: Record<string, unknown> = {
    model: `models/${model}`,
    content: { parts: [{ text: isV2 ? `title: none | text: ${text}` : text }] },
    outputDimensionality: DIM,
  };
  if (!isV2) body.taskType = "RETRIEVAL_DOCUMENT";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embedding?: { values?: number[] }; embeddings?: { values?: number[] }[] };
  const v = data.embedding?.values ?? data.embeddings?.[0]?.values;
  if (!v || v.length !== DIM) throw new Error(`Unexpected embedding length ${v?.length}`);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  const { data, error } = await db.from("knowledge_base").select("id, title, content_hindi").is("embedding", null);
  if (error) throw error;
  console.log(`${data?.length ?? 0} item(s) need embeddings`);
  for (const row of data ?? []) {
    const vector = await embed(`${row.title}\n${row.content_hindi}`);
    const { error: upErr } = await db.from("knowledge_base").update({ embedding: `[${vector.join(",")}]` }).eq("id", row.id);
    if (upErr) throw upErr;
    console.log(`  ✓ ${row.title}`);
    await new Promise((r) => setTimeout(r, 250)); // stay well inside free-tier rate limits
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
