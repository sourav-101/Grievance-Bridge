import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNoDbError, handleRouteError, jsonError, msgFor } from "@/lib/http";
import { normalizeIndianPhone } from "@/lib/auth/otp";
import { authMode } from "@/lib/auth/pin";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ phone: z.string().min(10).max(20) });

/**
 * Step 1 of login. Tells the client which screen comes next:
 *   { mode: "otp" }                                → call /api/auth/send-otp
 *   { mode: "pin", status: "new" }                 → create a PIN
 *   { mode: "pin", status: "existing", locked? }   → enter PIN
 *   { mode: "pin", status: "reset" }               → enter Estate Office reset code + new PIN
 */
export async function POST(req: Request) {
  try {
    const m = msgFor(req);
    const phone = normalizeIndianPhone(Body.parse(await req.json()).phone);
    if (!phone) return jsonError(m("कृपया सही 10 अंकों का मोबाइल नंबर डालें।", "Please enter a valid 10 digit mobile number."));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`auth-start:${ip}`, 30, 10 * 60_000)) return jsonError(m("बहुत ज़्यादा कोशिशें। कुछ देर बाद प्रयास करें।", "Too many attempts. Please try again later."), 429);

    if (authMode() === "otp") return NextResponse.json({ mode: "otp", phone });

    const { data, error } = await supabaseAdmin()
      .from("worker_credentials")
      .select("pin_hash, reset_code_hash, locked_until")
      .eq("phone_number", phone)
      .maybeSingle();
    // Never treat a failed lookup as "new user" — that would let a PIN be re-created.
    assertNoDbError(error, "load worker_credentials");

    const status = !data ? "new" : data.reset_code_hash ? "reset" : data.pin_hash ? "existing" : "new";
    const lockedForSeconds =
      data?.locked_until && new Date(data.locked_until).getTime() > Date.now()
        ? Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 1000)
        : 0;
    return NextResponse.json({ mode: "pin", phone, status, lockedForSeconds });
  } catch (err) {
    return handleRouteError(err, "auth:start");
  }
}
