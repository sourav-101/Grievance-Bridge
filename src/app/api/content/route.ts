import { NextResponse } from "next/server";
import { SECTIONS, isKnowledgeCategory } from "@/lib/constants";
import { handleRouteError, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Published knowledge cards for a worker section: /api/content?section=schemes */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const section = url.searchParams.get("section") || "";
    const category = SECTIONS[section]?.category ?? url.searchParams.get("category");
    if (!isKnowledgeCategory(category)) return jsonError("Unknown section");
    const { data, error } = await supabaseAdmin()
      .from("knowledge_base")
      // "*" (not a column list) so this keeps working before migration 0005 adds the English columns.
      .select("*")
      .eq("category", category)
      .eq("is_published", true)
      .order("sort_order")
      .order("title");
    if (error) throw new Error(error.message);
    const items = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      content_hindi: r.content_hindi,
      title_english: r.title_english ?? null,
      content_english: r.content_english ?? null,
      is_placeholder: r.is_placeholder,
      sort_order: r.sort_order,
      updated_at: r.updated_at,
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (err) {
    return handleRouteError(err, "content");
  }
}
