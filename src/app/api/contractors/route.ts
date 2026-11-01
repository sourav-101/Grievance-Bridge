import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { requireVerifiedPhone } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Active agencies for the onboarding picker (name + type only). */
export async function GET() {
  try {
    const auth = await requireVerifiedPhone();
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await supabaseAdmin()
      .from("contractors")
      .select("id, agency_name, contract_type")
      .eq("is_active", true)
      .order("agency_name");
    if (error) throw new Error(error.message);
    return NextResponse.json({ contractors: data ?? [] });
  } catch (err) {
    return handleRouteError(err, "contractors");
  }
}
