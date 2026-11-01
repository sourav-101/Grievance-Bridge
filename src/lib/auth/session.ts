import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_MAX_AGE_SECONDS,
  WORKER_COOKIE,
  signWorkerSession,
  verifyWorkerSession,
  type WorkerSession,
} from "./session-token";
import { jsonError } from "../http";

export async function getWorkerSession(): Promise<WorkerSession | null> {
  const store = await cookies();
  return verifyWorkerSession(store.get(WORKER_COOKIE)?.value);
}

export async function setWorkerSessionCookie(res: NextResponse, session: WorkerSession): Promise<void> {
  const token = await signWorkerSession(session);
  res.cookies.set(WORKER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearWorkerSessionCookie(res: NextResponse): void {
  res.cookies.set(WORKER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type WorkerAuth = { session: WorkerSession; workerId: string };

/**
 * Route guard. Returns the session (with a guaranteed workerId) or a 401/403
 * response to return directly.
 */
export async function requireWorker(): Promise<WorkerAuth | NextResponse> {
  const session = await getWorkerSession();
  if (!session) return jsonError("कृपया पहले लॉग इन करें।", 401);
  if (!session.workerId) return jsonError("कृपया पहले अपनी प्रोफ़ाइल बनाएं।", 403, { needsOnboarding: true });
  return { session, workerId: session.workerId };
}

/** Like requireWorker but allows a verified phone without a profile yet (onboarding). */
export async function requireVerifiedPhone(): Promise<WorkerSession | NextResponse> {
  const session = await getWorkerSession();
  if (!session) return jsonError("कृपया पहले लॉग इन करें।", 401);
  return session;
}
