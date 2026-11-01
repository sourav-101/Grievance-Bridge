/**
 * Signed tokens (HS256 JWT via `jose`). Edge-runtime safe — imported by middleware.
 */
import { SignJWT, jwtVerify } from "jose";

export const WORKER_COOKIE = "iitr_worker_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface WorkerSession {
  phone: string;
  /** null until the worker has completed onboarding (profile row created). */
  workerId: string | null;
}

function secretKey(): Uint8Array {
  const s = process.env.WORKER_SESSION_SECRET;
  if (!s || s.length < 32 || s.startsWith("YOUR_")) {
    throw new Error("WORKER_SESSION_SECRET must be set to at least 32 random characters.");
  }
  return new TextEncoder().encode(s);
}

export async function signWorkerSession(session: WorkerSession): Promise<string> {
  return new SignJWT({ phone: session.phone, wid: session.workerId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("worker-session")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyWorkerSession(token: string | undefined | null): Promise<WorkerSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: "worker-session" });
    if (typeof payload.phone !== "string") return null;
    return { phone: payload.phone, workerId: typeof payload.wid === "string" ? payload.wid : null };
  } catch {
    return null;
  }
}

/** Generic short-lived signed payload (used for grievance drafts). */
export async function signPayload(payload: Record<string, unknown>, audience: string, ttl = "30m"): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

export async function verifyPayload<T>(token: string, audience: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience });
    return payload as T;
  } catch {
    return null;
  }
}
