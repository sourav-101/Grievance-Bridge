import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { KnowledgeBody } from "@/lib/admin/schemas";
import { handleRouteError } from "@/lib/http";
import { translateKnowledgeItem } from "@/lib/i18n/english-content";
import { embedKnowledgeItem } from "@/lib/ai/knowledge";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Self-service FAQ / notice manager: list all knowledge items. */
export async function GET() {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const db = supabaseAdmin();
    const [{ data, error }, { data: embedded }] = await Promise.all([
      db
        .from("knowledge_base")
        .select("id, title, category, content_hindi, is_published, is_placeholder, sort_order, updated_at")
        .order("category")
        .order("sort_order"),
      db.from("knowledge_base").select("id").not("embedding", "is", null),
    ]);
    if (error) throw new Error(error.message);
    const withVector = new Set((embedded ?? []).map((r: { id: string }) => r.id));
    const items = ((data ?? []) as { id: string }[]).map((row) => ({ ...row, has_embedding: withVector.has(row.id) }));
    return NextResponse.json({ items });
  } catch (err) {
    return handleRouteError(err, "admin:content:list");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const body = KnowledgeBody.parse(await req.json());
    const { data, error } = await supabaseAdmin()
      .from("knowledge_base")
      .insert({
        title: body.title,
        category: body.category,
        content_hindi: body.contentHindi,
        is_published: body.isPublished,
        is_placeholder: body.isPlaceholder,
        sort_order: body.sortOrder,
        updated_by: auth.admin.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message);
    // English copy for the site's English mode (best effort; the Hindi is saved either way).
    await translateKnowledgeItem(data.id, body.title, body.contentHindi);
    let embedded = false;
    try {
      embedded = await embedKnowledgeItem(data.id, body.title, body.contentHindi);
    } catch (e) {
      console.warn("embedding failed; item saved without it", e);
    }
    return NextResponse.json({ ok: true, id: data.id, embedded });
  } catch (err) {
    return handleRouteError(err, "admin:content:create");
  }
}
