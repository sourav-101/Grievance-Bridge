import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http";
import { getWorkerSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Current worker session + profile (null profile = still onboarding). */
export async function GET() {
  try {
    const session = await getWorkerSession();
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
    if (!session.workerId) return NextResponse.json({ authenticated: true, phone: session.phone, profile: null });

    const { data } = await supabaseAdmin()
      .from("workers")
      .select("id, full_name, age, preferred_dialect, work_type, contractor_id, contractors(agency_name)")
      .eq("id", session.workerId)
      .maybeSingle();
    if (!data) return NextResponse.json({ authenticated: true, phone: session.phone, profile: null });

    const agency = (data as { contractors?: { agency_name?: string } | null }).contractors?.agency_name ?? null;
    return NextResponse.json({
      authenticated: true,
      phone: session.phone,
      profile: {
        id: data.id,
        fullName: data.full_name,
        age: data.age,
        dialect: data.preferred_dialect,
        workType: data.work_type,
        contractorId: data.contractor_id,
        agencyName: agency,
      },
    });
  } catch (err) {
    return handleRouteError(err, "me");
  }
}
