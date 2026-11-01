import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { isConfigured } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import { embedMissing } from "@/lib/ai/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby limit; indexing ~20 articles takes ~15 s

/** Embed all knowledge items that are missing a vector. */
export async function POST() {
  try {
    const auth = await requireAdmin("content.manage");
    if (auth instanceof NextResponse) return auth;
    if (!isConfigured("GEMINI_API_KEY")) return jsonError("GEMINI_API_KEY is not configured.", 503);
    return NextResponse.json(await embedMissing());
  } catch (err) {
    return handleRouteError(err, "admin:content:embed");
  }
}
