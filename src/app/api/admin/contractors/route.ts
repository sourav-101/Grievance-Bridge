import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { ContractorBody } from "@/lib/admin/schemas";
import { handleRouteError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Agencies list (any admin may read names — needed for filters and user management). */
export async function GET() {
  try {
    const auth = await requireAdmin("tickets.view");
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await supabaseAdmin().from("contractors").select("*").order("agency_name");
    if (error) throw new Error(error.message);
    return NextResponse.json({ contractors: data ?? [] });
  } catch (err) {
    return handleRouteError(err, "admin:contractors:list");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const b = ContractorBody.parse(await req.json());
    const { data, error } = await supabaseAdmin()
      .from("contractors")
      .insert({
        agency_name: b.agencyName,
        contract_type: b.contractType,
        supervisor_name: b.supervisorName,
        contact_phone: b.contactPhone,
        is_active: b.isActive,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return handleRouteError(err, "admin:contractors:create");
  }
}
