import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "../supabase/server";
import { supabaseAdmin } from "../supabase/admin";
import { can, type Permission } from "./rbac";
import { jsonError } from "../http";
import type { AdminUser } from "../types";

export type AdminAuth = { admin: AdminUser };

/** Current signed-in admin (Supabase Auth + active admin_users row), or null. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return (data as AdminUser | null) ?? null;
}

/** Route guard for admin APIs. */
export async function requireAdmin(permission?: Permission): Promise<AdminAuth | NextResponse> {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError("Not signed in as an administrator.", 401);
  if (permission && !can(admin.role, permission)) return jsonError("You do not have permission for this action.", 403);
  return { admin };
}

export function actorLabel(admin: AdminUser): string {
  const role = admin.role === "dean" ? "Dean" : admin.role === "estate_officer" ? "Estate Officer" : "Contractor";
  return `${role}: ${admin.full_name}`;
}
