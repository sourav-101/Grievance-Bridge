import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { HelplineBody } from "@/lib/admin/schemas";
import { handleRouteError } from "@/lib/http";
import { translateHelpline } from "@/lib/i18n/english-content";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const b = HelplineBody.partial().parse(await req.json());
    const update: Record<string, unknown> = {};
    if (b.kind !== undefined) update.kind = b.kind;
    if (b.nameHindi !== undefined) update.name_hindi = b.nameHindi;
    if (b.nameEnglish !== undefined) update.name_english = b.nameEnglish;
    if (b.phone !== undefined) update.phone = b.phone;
    if (b.instructionsHindi !== undefined) update.instructions_hindi = b.instructionsHindi;
    if (b.isPlaceholder !== undefined) update.is_placeholder = b.isPlaceholder;
    if (b.sortOrder !== undefined) update.sort_order = b.sortOrder;
    const { error } = await supabaseAdmin().from("helplines").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    if (b.instructionsHindi !== undefined || b.nameEnglish !== undefined) {
      const { data: h } = await supabaseAdmin().from("helplines").select("name_english, instructions_hindi").eq("id", id).maybeSingle();
      if (h) await translateHelpline(id, h.name_english, h.instructions_hindi);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:helplines:update");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const { error } = await supabaseAdmin().from("helplines").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:helplines:delete");
  }
}
