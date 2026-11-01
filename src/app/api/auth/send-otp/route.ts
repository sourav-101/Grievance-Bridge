import { NextResponse } from "next/server";
import { z } from "zod";
import { isOtpDevMode } from "@/lib/env";
import { sendOtpSms } from "@/lib/auth/fast2sms";
import { handleRouteError, jsonError } from "@/lib/http";
import {
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_SEND_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  normalizeIndianPhone,
} from "@/lib/auth/otp";
import { authMode } from "@/lib/auth/pin";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ phone: z.string().min(10).max(20) });

export async function POST(req: Request) {
  try {
    // OTP (and its dev-mode on-screen code) is only available when AUTH_MODE=otp,
    // so it can never be used to bypass PIN login.
    if (authMode() !== "otp") return jsonError("OTP login is disabled (AUTH_MODE is not 'otp').", 404);
    const { phone: rawPhone } = Body.parse(await req.json());
    const phone = normalizeIndianPhone(rawPhone);
    if (!phone) return jsonError("कृपया सही 10 अंकों का मोबाइल नंबर डालें।");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`otp-ip:${ip}`, 20, 60 * 60 * 1000)) return jsonError("बहुत ज़्यादा कोशिशें। कुछ देर बाद प्रयास करें।", 429);

    const db = supabaseAdmin();
    const now = Date.now();
    const { data: existing } = await db.from("otp_codes").select("*").eq("phone_number", phone).maybeSingle();

    let sendCount = 1;
    let windowStartedAt = new Date(now).toISOString();
    if (existing) {
      const windowStart = new Date(existing.window_started_at).getTime();
      if (now - windowStart < OTP_SEND_WINDOW_SECONDS * 1000) {
        if (existing.send_count >= OTP_MAX_SENDS_PER_WINDOW) {
          return jsonError("बहुत बार OTP मांगा गया है। 15 मिनट बाद फिर कोशिश करें।", 429);
        }
        sendCount = existing.send_count + 1;
        windowStartedAt = existing.window_started_at;
      }
    }

    const code = generateOtp();
    const { error } = await db.from("otp_codes").upsert({
      phone_number: phone,
      code_hash: hashOtp(phone, code),
      expires_at: new Date(now + OTP_TTL_SECONDS * 1000).toISOString(),
      attempts: 0,
      send_count: sendCount,
      window_started_at: windowStartedAt,
    });
    if (error) throw new Error(error.message);

    if (isOtpDevMode()) {
      console.info(`[OTP_DEV_MODE] OTP for ${phone}: ${code}`);
      return NextResponse.json({ ok: true, devCode: code, expiresIn: OTP_TTL_SECONDS });
    }
    await sendOtpSms(phone, code);
    return NextResponse.json({ ok: true, expiresIn: OTP_TTL_SECONDS });
  } catch (err) {
    return handleRouteError(err, "send-otp");
  }
}
