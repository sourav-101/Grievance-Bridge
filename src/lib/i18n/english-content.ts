import "server-only";
import { groqJson } from "../ai/groq";
import { isConfigured } from "../env";
import { supabaseAdmin } from "../supabase/admin";

const SYSTEM = `You translate notices for contract workers at IIT Roorkee from Hindi into simple, plain Indian English.
Keep every number, amount, date, phone number, scheme name and place name exactly. Keep "[PLACEHOLDER …]" markers unchanged.
Keep line breaks. Use short, easy sentences.
Return JSON {"title": "<English title>", "text": "<English text>"}.`;

/** Translate a title + body to English (null when the AI is not configured or fails). */
export async function toEnglish(title: string, text: string): Promise<{ title: string; text: string } | null> {
  if (!isConfigured("GROQ_API_KEY")) return null;
  try {
    const r = await groqJson<{ title?: string; text?: string }>(SYSTEM, JSON.stringify({ title, text }), {
      temperature: 0.1,
      maxTokens: 1500,
      effort: "low",
    });
    return r.title?.trim() && r.text?.trim() ? { title: r.title.trim(), text: r.text.trim() } : null;
  } catch (e) {
    console.warn("English translation failed", e);
    return null;
  }
}

/** Store the English copy of a knowledge item (best effort — the Hindi stays the source). */
export async function translateKnowledgeItem(id: string, titleHindi: string, contentHindi: string): Promise<boolean> {
  const en = await toEnglish(titleHindi, contentHindi);
  if (!en) return false;
  const { error } = await supabaseAdmin().from("knowledge_base").update({ title_english: en.title, content_english: en.text }).eq("id", id);
  if (error) console.warn("saving English article failed (run migration 0005?)", error.message);
  return !error;
}

/** Store the English instructions of a helpline (best effort). */
export async function translateHelpline(id: string, nameEnglish: string, instructionsHindi: string): Promise<boolean> {
  const en = await toEnglish(nameEnglish, instructionsHindi);
  if (!en) return false;
  const { error } = await supabaseAdmin().from("helplines").update({ instructions_english: en.text }).eq("id", id);
  if (error) console.warn("saving English helpline failed (run migration 0005?)", error.message);
  return !error;
}
