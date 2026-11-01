import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { normalizeIndianPhone } from "@/lib/auth/otp";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Look up a worker by phone for the PIN-reset desk: /api/admin/workers?phone=98765… */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin("workers.resetPin");
    if (auth instanceof NextResponse) return auth;
    const phone = normalizeIndianPhone(new URL(req.url).searchParams.get("phone") || "");
    if (!phone) return jsonError("Enter a valid 10-digit mobile number.");

    const db = supabaseAdmin();
    const [{ data: worker }, { data: cred }] = await Promise.all([
      db.from("workers").select("id, full_name, age, work_type, created_at, contractors(agency_name)").eq("phone_number", phone).maybeSingle(),
      db.from("worker_credentials").select("pin_hash, reset_code_hash, reset_expires_at, locked_until, reset_at").eq("phone_number", phone).maybeSingle(),
    ]);

    return NextResponse.json({
      phone,
      worker: worker
        ? {
            id: worker.id,
            name: worker.full_name,
            age: worker.age,
            workType: worker.work_type,
            agency: (worker as { contractors?: { agency_name?: string } | null }).contractors?.agency_name ?? null,
            registeredAt: worker.created_at,
          }
        : null,
      credential: cred
        ? {
            hasPin: Boolean(cred.pin_hash),
            resetPending: Boolean(cred.reset_code_hash),
            resetExpiresAt: cred.reset_expires_at,
            lockedUntil: cred.locked_until && new Date(cred.locked_until).getTime() > Date.now() ? cred.locked_until : null,
            lastResetAt: cred.reset_at,
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err, "admin:workers:lookup");
  }
}
