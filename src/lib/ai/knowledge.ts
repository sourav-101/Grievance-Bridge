import "server-only";
import { embedText, toPgVector } from "./embeddings";
import { isConfigured } from "../env";
import { supabaseAdmin } from "../supabase/admin";

/** Text that is embedded for a knowledge item. */
export const embeddingInput = (title: string, content: string) => `${title}\n${content}`;

/** (Re)compute the embedding for one item. Returns false if embeddings are not configured. */
export async function embedKnowledgeItem(id: string, title: string, content: string): Promise<boolean> {
  if (!isConfigured("GEMINI_API_KEY")) return false;
  const vector = await embedText(embeddingInput(title, content), "document");
  const { error } = await supabaseAdmin().from("knowledge_base").update({ embedding: toPgVector(vector) }).eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

/** Embed every item that has no embedding yet. */
export async function embedMissing(limit = 200): Promise<{ embedded: number; failed: number }> {
  const { data, error } = await supabaseAdmin()
    .from("knowledge_base")
    .select("id, title, content_hindi")
    .is("embedding", null)
    .limit(limit);
  if (error) throw new Error(error.message);
  let embedded = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      if (await embedKnowledgeItem(row.id, row.title, row.content_hindi)) embedded++;
    } catch (e) {
      failed++;
      console.warn("embed failed for", row.id, e);
    }
  }
  return { embedded, failed };
}
