import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  role: z.enum(["dean", "estate_officer", "contractor"]).optional(),
  contractorId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
});

/** Dean-only: change role / agency / active flag. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("users.manage");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const b = Body.parse(await req.json());
    if (id === auth.admin.id && (b.isActive === false || (b.role && b.role !== "dean"))) {
      return jsonError("You cannot demote or deactivate your own account.");
    }
    const db = supabaseAdmin();
    const { data: existing } = await db.from("admin_users").select("role, contractor_id").eq("id", id).maybeSingle();
    if (!existing) return jsonError("User not found", 404);

    const role = b.role ?? existing.role;
    const contractorId = b.contractorId !== undefined ? b.contractorId : existing.contractor_id;
    if (role === "contractor" && !contractorId) return jsonError("Contractor accounts must be linked to an agency.");

    const update: Record<string, unknown> = { role, contractor_id: role === "contractor" ? contractorId : null };
    if (b.isActive !== undefined) update.is_active = b.isActive;
    if (b.fullName) update.full_name = b.fullName;
    const { error } = await db.from("admin_users").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:users:update");
  }
}
