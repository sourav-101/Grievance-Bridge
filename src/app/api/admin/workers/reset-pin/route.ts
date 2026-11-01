import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { normalizeIndianPhone } from "@/lib/auth/otp";
import { RESET_CODE_TTL_HOURS, generateResetCode, hashSecret } from "@/lib/auth/pin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ phone: z.string() });

/**
 * Issue a one-time 6-digit reset code (valid 48 h). The worker's old PIN stops
 * working immediately; on next login they enter this code and choose a new PIN.
 * The code is shown ONCE to the admin and only its hash is stored.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin("workers.resetPin");
    if (auth instanceof NextResponse) return auth;
    const phone = normalizeIndianPhone(Body.parse(await req.json()).phone);
    if (!phone) return jsonError("Enter a valid 10-digit mobile number.");

    const db = supabaseAdmin();
    const [{ data: worker }, { data: cred }] = await Promise.all([
      db.from("workers").select("id").eq("phone_number", phone).maybeSingle(),
      db.from("worker_credentials").select("phone_number").eq("phone_number", phone).maybeSingle(),
    ]);
    if (!worker && !cred) return jsonError("No worker is registered with this number.", 404);

    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_HOURS * 3600_000).toISOString();
    const { error } = await db.from("worker_credentials").upsert({
      phone_number: phone,
      pin_hash: null,
      reset_code_hash: await hashSecret(phone, code),
      reset_expires_at: expiresAt,
      reset_by_admin: auth.admin.id,
      reset_at: new Date().toISOString(),
      failed_attempts: 0,
      locked_until: null,
    });
    if (error) throw new Error(error.message);
    console.info(`[pin-reset] ${auth.admin.email} reset PIN for worker ${worker?.id ?? phone.slice(-4)}`);
    return NextResponse.json({ ok: true, resetCode: code, expiresAt });
  } catch (err) {
    return handleRouteError(err, "admin:workers:reset-pin");
  }
}
