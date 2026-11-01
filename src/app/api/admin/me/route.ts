import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError } from "@/lib/http";
import { ROLE_LABELS, permissionsFor } from "@/lib/auth/rbac";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;
    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, fullName: admin.full_name, role: admin.role, roleLabel: ROLE_LABELS[admin.role], contractorId: admin.contractor_id },
      permissions: permissionsFor(admin.role),
    });
  } catch (err) {
    return handleRouteError(err, "admin:me");
  }
}
