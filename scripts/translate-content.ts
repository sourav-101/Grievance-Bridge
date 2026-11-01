/**
 * Fill the English copies of articles and helplines (run once after migration 0005;
 * new edits in the Content Manager are translated automatically).
 *   npm run translate:content            only rows without English
 *   npm run translate:content -- --all   redo every row
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY"]) {
  if (!process.env[k] || process.env[k]!.includes("YOUR_")) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const redoAll = process.argv.includes("--all");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM = `You translate notices for contract workers at IIT Roorkee from Hindi into simple, plain Indian English.
Keep every number, amount, date, phone number, scheme name and place name exactly. Keep "[PLACEHOLDER …]" markers unchanged.
Keep line breaks. Use short, easy sentences.
Return JSON {"title": "<English title>", "text": "<English text>"}.`;

/** Groq says "Please try again in 7.36s", "in 2m30.5s" or "in 1h5m0s". */
function retryAfterSeconds(message: string): number {
  const m = message.match(/try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/);
  if (!m) return 15;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]);
}

async function toEnglish(title: string, text: string, attempt = 0): Promise<{ title: string; text: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(60_000), // never hang on a request Groq doesn't answer
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1200, // articles are short; Groq counts this reservation against its limits
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify({ title, text }) },
        ],
      }),
    });
  } catch (e) {
    if (attempt >= 4) throw e;
    console.warn(`    request failed (${(e as Error).name}), retrying…`);
    await sleep(5000);
    return toEnglish(title, text, attempt + 1);
  }
  // Free tier: 8,000 tokens/minute. Wait as long as Groq asks, then retry.
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const detail = await res.text();
    const wait = retryAfterSeconds(detail);
    const which = detail.match(/\((TPM|TPD|RPM|RPD)\)/)?.[1];
    const label = which === "TPD" ? "daily token limit" : which === "RPD" ? "daily request limit" : which ? "per-minute limit" : `HTTP ${res.status}`;
    if (wait > 15 * 60) {
      throw new Error(`Groq ${label} reached; try again in about ${Math.ceil(wait / 60)} minutes (or upgrade the Groq plan).`);
    }
    console.log(`    ${label} reached, waiting ${wait < 90 ? `${Math.ceil(wait)} s` : `${Math.ceil(wait / 60)} min`}…`);
    await sleep((wait + 1) * 1000);
    return toEnglish(title, text, attempt + 1);
  }
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const r = JSON.parse(data.choices?.[0]?.message?.content || "{}") as { title?: string; text?: string };
  if (!r.title?.trim() || !r.text?.trim()) throw new Error("empty translation");
  return { title: r.title.trim(), text: r.text.trim() };
}

async function main() {
  const { data: articles, error } = await db.from("knowledge_base").select("*").order("category");
  if (error) throw new Error(error.message);
  if (articles?.length && !("content_english" in articles[0])) {
    console.error("The English columns are missing. Run supabase/migrations/0005_english_content.sql in the SQL Editor first.");
    process.exit(1);
  }
  const todoArticles = (articles ?? []).filter((a) => redoAll || !a.content_english);
  console.log(`Articles: ${todoArticles.length} to translate`);
  let ok = 0;
  for (const a of todoArticles) {
    try {
      const en = await toEnglish(a.title, a.content_hindi);
      const { error: upErr } = await db.from("knowledge_base").update({ title_english: en.title, content_english: en.text }).eq("id", a.id);
      if (upErr) throw new Error(upErr.message);
      ok++;
      console.log(`  ✓ ${en.title}`);
    } catch (e) {
      console.warn(`  ✗ ${a.title}: ${(e as Error).message}`);
    }
  }

  const { data: lines } = await db.from("helplines").select("*").order("sort_order");
  const todoLines = (lines ?? []).filter((h) => redoAll || !h.instructions_english);
  console.log(`Helplines: ${todoLines.length} to translate`);
  for (const h of todoLines) {
    try {
      const en = await toEnglish(h.name_english, h.instructions_hindi);
      const { error: upErr } = await db.from("helplines").update({ instructions_english: en.text }).eq("id", h.id);
      if (upErr) throw new Error(upErr.message);
      ok++;
      console.log(`  ✓ ${h.name_english}`);
    } catch (e) {
      console.warn(`  ✗ ${h.name_english}: ${(e as Error).message}`);
    }
  }
  console.log(`Done: ${ok}/${todoArticles.length + todoLines.length} translated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
