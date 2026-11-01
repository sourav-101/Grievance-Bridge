import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Dean-only: list admin accounts. */
export async function GET() {
  try {
    const auth = await requireAdmin("users.manage");
    if (auth instanceof NextResponse) return auth;
    const { data, error } = await supabaseAdmin()
      .from("admin_users")
      .select("id, email, full_name, role, contractor_id, is_active, created_at, contractors(agency_name)")
      .order("created_at");
    if (error) throw new Error(error.message);
    return NextResponse.json({ users: data ?? [] });
  } catch (err) {
    return handleRouteError(err, "admin:users:list");
  }
}

const CreateBody = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(72),
  role: z.enum(["dean", "estate_officer", "contractor"]),
  contractorId: z.string().uuid().nullable(),
});

/** Dean-only: create a Supabase Auth user + admin role. */
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin("users.manage");
    if (auth instanceof NextResponse) return auth;
    const b = CreateBody.parse(await req.json());
    if (b.role === "contractor" && !b.contractorId) return jsonError("Contractor accounts must be linked to an agency.");

    const db = supabaseAdmin();
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email: b.email,
      password: b.password,
      email_confirm: true,
      user_metadata: { full_name: b.fullName },
    });
    if (authErr || !created.user) return jsonError(authErr?.message || "Could not create user");

    const { error } = await db.from("admin_users").insert({
      id: created.user.id,
      email: b.email,
      full_name: b.fullName,
      role: b.role,
      contractor_id: b.role === "contractor" ? b.contractorId : null,
    });
    if (error) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, id: created.user.id });
  } catch (err) {
    return handleRouteError(err, "admin:users:create");
  }
}
