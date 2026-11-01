import { z } from "zod";
import { handleRouteError, jsonError } from "@/lib/http";
import { OTP_MAX_ATTEMPTS, normalizeIndianPhone, verifyOtpHash } from "@/lib/auth/otp";
import { authMode } from "@/lib/auth/pin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completeWorkerLogin } from "@/lib/auth/worker-login";

const Body = z.object({ phone: z.string(), code: z.string().regex(/^\d{4}$/) });

export async function POST(req: Request) {
  try {
    if (authMode() !== "otp") return jsonError("OTP login is disabled (AUTH_MODE is not 'otp').", 404);
    const body = Body.parse(await req.json());
    const phone = normalizeIndianPhone(body.phone);
    if (!phone) return jsonError("मोबाइल नंबर सही नहीं है।");

    const db = supabaseAdmin();
    const { data: row } = await db.from("otp_codes").select("*").eq("phone_number", phone).maybeSingle();
    if (!row) return jsonError("OTP नहीं मिला। कृपया नया OTP मांगें।");
    if (new Date(row.expires_at).getTime() < Date.now()) return jsonError("OTP की समय सीमा खत्म हो गई। नया OTP मांगें।");
    if (row.attempts >= OTP_MAX_ATTEMPTS) return jsonError("बहुत गलत कोशिशें। नया OTP मांगें।", 429);

    if (!verifyOtpHash(phone, body.code, row.code_hash)) {
      await db.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("phone_number", phone);
      return jsonError("OTP गलत है। फिर से कोशिश करें।", 401, { attemptsLeft: OTP_MAX_ATTEMPTS - row.attempts - 1 });
    }

    // Single use.
    await db.from("otp_codes").delete().eq("phone_number", phone);
    return completeWorkerLogin(phone);
  } catch (err) {
    return handleRouteError(err, "verify-otp");
  }
}
