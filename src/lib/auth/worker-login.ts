import "server-only";
import { NextResponse } from "next/server";
import { assertNoDbError } from "../http";
import { setWorkerSessionCookie } from "./session";
import { supabaseAdmin } from "../supabase/admin";

/** Shared last step of OTP and PIN login: look up the profile and set the session cookie. */
export async function completeWorkerLogin(phone: string): Promise<NextResponse> {
  const db = supabaseAdmin();
  const { data: worker, error } = await db.from("workers").select("*").eq("phone_number", phone).maybeSingle();
  assertNoDbError(error, "load worker");
  if (worker && !worker.is_phone_verified) {
    await db.from("workers").update({ is_phone_verified: true }).eq("id", worker.id);
  }
  const res = NextResponse.json({
    ok: true,
    isNewWorker: !worker,
    worker: worker ? { id: worker.id, fullName: worker.full_name, dialect: worker.preferred_dialect } : null,
  });
  await setWorkerSessionCookie(res, { phone, workerId: worker?.id ?? null });
  return res;
}
