import { z } from "zod";
import { assertNoDbError, handleRouteError, jsonError, msgFor } from "@/lib/http";
import { normalizeIndianPhone } from "@/lib/auth/otp";
import {
  PIN_LOCK_MINUTES,
  PIN_MAX_ATTEMPTS,
  authMode,
  hashSecret,
  isWeakPin,
  verifySecret,
} from "@/lib/auth/pin";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completeWorkerLogin } from "@/lib/auth/worker-login";

const Pin = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), phone: z.string(), pin: Pin }),
  z.object({ action: z.literal("login"), phone: z.string(), pin: Pin }),
  z.object({ action: z.literal("reset"), phone: z.string(), pin: Pin, resetCode: z.string().regex(/^\d{6}$/) }),
]);


/**
 * PIN login (AUTH_MODE=pin).
 *   create — first time on this phone: set a PIN
 *   login  — enter PIN (5 wrong tries → locked for 15 minutes)
 *   reset  — Estate Office gave a one-time 6-digit code: enter it + a new PIN
 */
export async function POST(req: Request) {
  try {
    if (authMode() !== "pin") return jsonError("PIN login is disabled (AUTH_MODE is not 'pin').", 404);
    const m = msgFor(req);
    const WEAK_PIN_MSG = m("यह PIN बहुत आसान है (जैसे 1111 या 1234)। कोई और 4 अंक चुनें।", "This PIN is too easy (like 1111 or 1234). Choose 4 other digits.");
    const body = Body.parse(await req.json());
    const phone = normalizeIndianPhone(body.phone);
    if (!phone) return jsonError(m("मोबाइल नंबर सही नहीं है।", "The mobile number is not valid."));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`pin-ip:${ip}`, 40, 10 * 60_000)) return jsonError(m("बहुत ज़्यादा कोशिशें। कुछ देर बाद प्रयास करें।", "Too many attempts. Please try again later."), 429);

    const db = supabaseAdmin();
    const { data: cred, error: credErr } = await db.from("worker_credentials").select("*").eq("phone_number", phone).maybeSingle();
    assertNoDbError(credErr, "load worker_credentials");

    // ------------------------------------------------------------- create
    if (body.action === "create") {
      if (cred?.pin_hash || cred?.reset_code_hash) {
        return jsonError(m("इस नंबर का PIN पहले से बना है। अपना PIN डालें।", "A PIN already exists for this number. Enter your PIN."), 409);
      }
      if (isWeakPin(body.pin)) return jsonError(WEAK_PIN_MSG);
      const { error } = await db.from("worker_credentials").upsert({
        phone_number: phone,
        pin_hash: await hashSecret(phone, body.pin),
        failed_attempts: 0,
        locked_until: null,
      });
      if (error) throw new Error(error.message);
      return completeWorkerLogin(phone);
    }

    // ------------------------------------------------------------- login / reset share lockout
    if (!cred) return jsonError(m("इस नंबर का PIN नहीं बना है।", "No PIN has been created for this number."), 404);
    if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 60_000);
      return jsonError(m(`बहुत बार गलत PIN डाला गया। ${mins} मिनट बाद फिर कोशिश करें।`, `Too many wrong PINs. Try again after ${mins} minutes.`), 429, { lockedForSeconds: mins * 60 });
    }

    const registerFailure = async () => {
      const attempts = (cred.failed_attempts ?? 0) + 1;
      const locked = attempts >= PIN_MAX_ATTEMPTS;
      await db
        .from("worker_credentials")
        .update({
          failed_attempts: locked ? 0 : attempts,
          locked_until: locked ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString() : null,
        })
        .eq("phone_number", phone);
      return { attemptsLeft: locked ? 0 : PIN_MAX_ATTEMPTS - attempts, locked };
    };

    if (body.action === "login") {
      if (cred.reset_code_hash) return jsonError(m("आपका PIN रीसेट किया गया है। एस्टेट ऑफिस से मिला कोड डालें।", "Your PIN has been reset. Enter the code from the Estate Office."), 409, { status: "reset" });
      if (!(await verifySecret(phone, body.pin, cred.pin_hash))) {
        const f = await registerFailure();
        return jsonError(
          f.locked
            ? m(`बहुत बार गलत PIN। ${PIN_LOCK_MINUTES} मिनट बाद कोशिश करें।`, `Too many wrong PINs. Try again after ${PIN_LOCK_MINUTES} minutes.`)
            : m(`PIN गलत है। ${f.attemptsLeft} कोशिश बाकी।`, `Wrong PIN. ${f.attemptsLeft} tries left.`),
          401,
          f,
        );
      }
      await db.from("worker_credentials").update({ failed_attempts: 0, locked_until: null }).eq("phone_number", phone);
      return completeWorkerLogin(phone);
    }

    // reset
    if (!cred.reset_code_hash) return jsonError(m("कोई रीसेट कोड जारी नहीं हुआ है।", "No reset code has been issued."), 409);
    if (cred.reset_expires_at && new Date(cred.reset_expires_at).getTime() < Date.now()) {
      return jsonError(m("रीसेट कोड की समय सीमा खत्म हो गई। एस्टेट ऑफिस से नया कोड लें।", "The reset code has expired. Get a new code from the Estate Office."), 410);
    }
    if (!(await verifySecret(phone, body.resetCode, cred.reset_code_hash))) {
      const f = await registerFailure();
      return jsonError(
        f.locked
          ? m(`बहुत बार गलत कोड। ${PIN_LOCK_MINUTES} मिनट बाद कोशिश करें।`, `Too many wrong codes. Try again after ${PIN_LOCK_MINUTES} minutes.`)
          : m(`रीसेट कोड गलत है। ${f.attemptsLeft} कोशिश बाकी।`, `Wrong reset code. ${f.attemptsLeft} tries left.`),
        401,
        f,
      );
    }
    if (isWeakPin(body.pin)) return jsonError(WEAK_PIN_MSG);
    const { error } = await db
      .from("worker_credentials")
      .update({
        pin_hash: await hashSecret(phone, body.pin),
        reset_code_hash: null,
        reset_expires_at: null,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("phone_number", phone);
    if (error) throw new Error(error.message);
    return completeWorkerLogin(phone);
  } catch (err) {
    return handleRouteError(err, "auth:pin");
  }
}
