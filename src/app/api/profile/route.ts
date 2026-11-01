import { NextResponse } from "next/server";
import { z } from "zod";
import { DIALECT_IDS, WORK_TYPE_IDS } from "@/lib/constants";
import { handleRouteError, jsonError } from "@/lib/http";
import { getWorkerSession, setWorkerSessionCookie } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Dialect, WorkType } from "@/lib/types";

const CreateBody = z.object({
  fullName: z.string().trim().min(2).max(100),
  age: z.number().int().min(14).max(99).nullable(),
  workType: z.enum(WORK_TYPE_IDS as [WorkType, ...WorkType[]]).nullable(),
  contractorId: z.string().uuid().nullable(),
  dialect: z.enum(DIALECT_IDS as [Dialect, ...Dialect[]]),
});

/** Onboarding: create the worker profile for the verified phone in the session. */
export async function POST(req: Request) {
  try {
    const session = await getWorkerSession();
    if (!session) return jsonError("कृपया पहले लॉग इन करें।", 401);
    const body = CreateBody.parse(await req.json());
    const db = supabaseAdmin();

    if (body.contractorId) {
      const { data: c } = await db.from("contractors").select("id").eq("id", body.contractorId).eq("is_active", true).maybeSingle();
      if (!c) return jsonError("ठेकेदार एजेंसी नहीं मिली।");
    }

    const { data, error } = await db
      .from("workers")
      .upsert(
        {
          phone_number: session.phone,
          full_name: body.fullName,
          age: body.age,
          work_type: body.workType,
          contractor_id: body.contractorId,
          preferred_dialect: body.dialect,
          is_phone_verified: true,
        },
        { onConflict: "phone_number" },
      )
      .select("id, full_name, preferred_dialect")
      .single();
    if (error || !data) throw new Error(error?.message || "profile upsert failed");

    const res = NextResponse.json({ ok: true, profile: { id: data.id, fullName: data.full_name, dialect: data.preferred_dialect } });
    await setWorkerSessionCookie(res, { phone: session.phone, workerId: data.id });
    return res;
  } catch (err) {
    return handleRouteError(err, "profile:create");
  }
}

const PatchBody = z.object({
  dialect: z.enum(DIALECT_IDS as [Dialect, ...Dialect[]]).optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
  age: z.number().int().min(14).max(99).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getWorkerSession();
    if (!session?.workerId) return jsonError("कृपया पहले लॉग इन करें।", 401);
    const body = PatchBody.parse(await req.json());
    const update: Record<string, unknown> = {};
    if (body.dialect) update.preferred_dialect = body.dialect;
    if (body.fullName) update.full_name = body.fullName;
    if (body.age !== undefined) update.age = body.age;
    if (!Object.keys(update).length) return NextResponse.json({ ok: true });
    const { error } = await supabaseAdmin().from("workers").update(update).eq("id", session.workerId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "profile:patch");
  }
}
