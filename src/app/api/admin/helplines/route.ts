import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { HelplineBody } from "@/lib/admin/schemas";
import { handleRouteError } from "@/lib/http";
import { translateHelpline } from "@/lib/i18n/english-content";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await supabaseAdmin().from("helplines").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return NextResponse.json({ helplines: data ?? [] });
  } catch (err) {
    return handleRouteError(err, "admin:helplines:list");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const b = HelplineBody.parse(await req.json());
    const { data, error } = await supabaseAdmin()
      .from("helplines")
      .insert({
        kind: b.kind,
        name_hindi: b.nameHindi,
        name_english: b.nameEnglish,
        phone: b.phone,
        instructions_hindi: b.instructionsHindi,
        is_placeholder: b.isPlaceholder,
        sort_order: b.sortOrder,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await translateHelpline(data.id, b.nameEnglish, b.instructionsHindi);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return handleRouteError(err, "admin:helplines:create");
  }
}
