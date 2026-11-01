import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { ContractorBody } from "@/lib/admin/schemas";
import { handleRouteError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** Update an agency. (No delete — deactivate instead, so ticket history stays intact.) */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const b = ContractorBody.partial().parse(await req.json());
    const update: Record<string, unknown> = {};
    if (b.agencyName !== undefined) update.agency_name = b.agencyName;
    if (b.contractType !== undefined) update.contract_type = b.contractType;
    if (b.supervisorName !== undefined) update.supervisor_name = b.supervisorName;
    if (b.contactPhone !== undefined) update.contact_phone = b.contactPhone;
    if (b.isActive !== undefined) update.is_active = b.isActive;
    const { error } = await supabaseAdmin().from("contractors").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:contractors:update");
  }
}
