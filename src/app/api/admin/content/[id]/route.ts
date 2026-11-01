import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { translateKnowledgeItem } from "@/lib/i18n/english-content";
import { embedKnowledgeItem } from "@/lib/ai/knowledge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { KnowledgeBody } from "@/lib/admin/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const body = KnowledgeBody.partial().parse(await req.json());
    const db = supabaseAdmin();
    const { data: existing } = await db.from("knowledge_base").select("title, content_hindi").eq("id", id).maybeSingle();
    if (!existing) return jsonError("Not found", 404);

    const update: Record<string, unknown> = { updated_by: auth.admin.id };
    if (body.title !== undefined) update.title = body.title;
    if (body.category !== undefined) update.category = body.category;
    if (body.contentHindi !== undefined) update.content_hindi = body.contentHindi;
    if (body.isPublished !== undefined) update.is_published = body.isPublished;
    if (body.isPlaceholder !== undefined) update.is_placeholder = body.isPlaceholder;
    if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;

    const textChanged =
      (body.title !== undefined && body.title !== existing.title) ||
      (body.contentHindi !== undefined && body.contentHindi !== existing.content_hindi);
    if (textChanged) update.embedding = null; // stale until re-embedded below

    const { error } = await db.from("knowledge_base").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    let embedded = false;
    if (textChanged) {
      await translateKnowledgeItem(id, body.title ?? existing.title, body.contentHindi ?? existing.content_hindi);
      try {
        embedded = await embedKnowledgeItem(id, body.title ?? existing.title, body.contentHindi ?? existing.content_hindi);
      } catch (e) {
        console.warn("re-embedding failed", e);
      }
    }
    return NextResponse.json({ ok: true, embedded });
  } catch (err) {
    return handleRouteError(err, "admin:content:update");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const { error } = await supabaseAdmin().from("knowledge_base").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:content:delete");
  }
}
