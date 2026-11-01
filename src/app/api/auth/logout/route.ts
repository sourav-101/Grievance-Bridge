import { NextResponse } from "next/server";
import { clearWorkerSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearWorkerSessionCookie(res);
  return res;
}
