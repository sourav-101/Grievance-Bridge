import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Emergency helplines — public so the emergency card works even before login. */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from("helplines")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    const helplines = ((data ?? []) as Record<string, unknown>[]).map((h) => ({
      id: h.id,
      kind: h.kind,
      name_hindi: h.name_hindi,
      name_english: h.name_english,
      phone: h.phone,
      instructions_hindi: h.instructions_hindi,
      instructions_english: h.instructions_english ?? null,
      is_placeholder: h.is_placeholder,
      sort_order: h.sort_order,
    }));
    return NextResponse.json({ helplines }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    return handleRouteError(err, "helplines");
  }
}
