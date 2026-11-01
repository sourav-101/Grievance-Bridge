import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { ADMIN_TICKET_SELECT, toAdminCard } from "@/lib/admin/tickets";
import { isGrievanceCategory } from "@/lib/constants";
import { handleRouteError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Grievance } from "@/lib/types";

/**
 * Kanban feed: master tickets (duplicates folded in with a count). Emergencies
 * are pinned first in every column. Resolved tickets older than `resolvedDays` are hidden.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin("tickets.view");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;
    const url = new URL(req.url);
    const resolvedDays = Math.min(365, Math.max(1, Number(url.searchParams.get("resolvedDays")) || 30));
    const category = url.searchParams.get("category");
    const zone = url.searchParams.get("zone");
    const emergencyOnly = url.searchParams.get("emergency") === "1";

    let q = supabaseAdmin()
      .from("grievances")
      .select(ADMIN_TICKET_SELECT)
      .or(`status.neq.Resolved,resolved_at.gte.${new Date(Date.now() - resolvedDays * 86400_000).toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (admin.role === "contractor") q = q.eq("contractor_id", admin.contractor_id).eq("is_anonymous", false);
    if (isGrievanceCategory(category)) q = q.eq("category", category);
    if (zone) q = q.eq("campus_zone", zone);
    if (emergencyOnly) q = q.eq("is_emergency", true);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Grievance[];

    const dupCounts = new Map<string, number>();
    for (const r of rows) if (r.parent_ticket_id) dupCounts.set(r.parent_ticket_id, (dupCounts.get(r.parent_ticket_id) ?? 0) + 1);

    const cards = rows
      .filter((r) => !r.parent_ticket_id)
      .map((r) => toAdminCard(r, admin, dupCounts.get(r.id) ?? 0))
      .sort((a, b) => Number(b.isEmergency) - Number(a.isEmergency) || b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ tickets: cards });
  } catch (err) {
    return handleRouteError(err, "admin:grievances");
  }
}
