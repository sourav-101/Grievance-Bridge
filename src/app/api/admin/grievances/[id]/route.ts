import { NextResponse } from "next/server";
import { z } from "zod";
import { actorLabel, requireAdmin } from "@/lib/auth/admin-auth";
import { ADMIN_TICKET_SELECT, inScope, toAdminCard } from "@/lib/admin/tickets";
import { STATUSES } from "@/lib/constants";
import { handleRouteError, jsonError } from "@/lib/http";
import { allowedTargetStatuses, can } from "@/lib/auth/rbac";
import { signedAudioUrl, signedPhotoUrl, supabaseAdmin } from "@/lib/supabase/admin";
import type { Grievance, GrievanceStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function loadTicket(id: string) {
  const { data } = await supabaseAdmin().from("grievances").select(ADMIN_TICKET_SELECT).eq("id", id).maybeSingle();
  return data as (Grievance & Record<string, unknown>) | null;
}

/** Ticket detail: audio (signed URL), transcript, summary, duplicates, timeline, feedback. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("tickets.view");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;
    const { id } = await ctx.params;
    const row = await loadTicket(id);
    if (!row || !inScope(row, admin)) return jsonError("Ticket not found", 404);

    const db = supabaseAdmin();
    const [{ data: children }, { data: events }, { data: fb }, parent] = await Promise.all([
      db.from("grievances").select(ADMIN_TICKET_SELECT).eq("parent_ticket_id", id).order("created_at"),
      db.from("grievance_events").select("*").eq("grievance_id", id).order("created_at"),
      db.from("feedback").select("rating, feedback_transcript, feedback_audio_url, created_at").eq("grievance_id", id).maybeSingle(),
      row.parent_ticket_id
        ? db.from("grievances").select("id, ticket_token, status").eq("id", row.parent_ticket_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const visibleChildren = ((children ?? []) as Grievance[]).filter((c) => inScope(c, admin));
    return NextResponse.json({
      ticket: toAdminCard(row, admin, visibleChildren.length),
      audioUrl: await signedAudioUrl(row.raw_audio_url),
      photoUrl: await signedPhotoUrl(row.photo_url),
      duplicates: await Promise.all(
        visibleChildren.map(async (c) => ({
          ...toAdminCard(c, admin),
          audioUrl: await signedAudioUrl(c.raw_audio_url),
          photoUrl: await signedPhotoUrl(c.photo_url),
        })),
      ),
      parent: parent.data,
      events: events ?? [],
      feedback: fb
        ? {
            rating: fb.rating,
            transcript: fb.feedback_transcript,
            createdAt: fb.created_at,
            audioUrl: await signedAudioUrl(fb.feedback_audio_url),
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err, "admin:grievance:get");
  }
}

const Patch = z.object({
  status: z.enum(STATUSES as [GrievanceStatus, ...GrievanceStatus[]]).optional(),
  resolutionNoteHindi: z.string().trim().max(1000).nullable().optional(),
  assignedDepartment: z.string().trim().min(2).max(100).optional(),
  note: z.string().trim().max(1000).optional(),
  mergeIntoToken: z.string().regex(/^\d{4,6}$/).optional(),
  unmerge: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const auth = await requireAdmin("tickets.update");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;
    const { id } = await ctx.params;
    const body = Patch.parse(await req.json());
    const row = await loadTicket(id);
    if (!row || !inScope(row, admin)) return jsonError("Ticket not found", 404);

    const db = supabaseAdmin();
    const actor = actorLabel(admin);
    const update: Record<string, unknown> = {};
    const events: Record<string, unknown>[] = [];

    // ---------------------------------------------------------- merge / unmerge (duplicate clustering)
    if (body.mergeIntoToken || body.unmerge) {
      if (!can(admin.role, "tickets.merge")) return jsonError("You cannot merge tickets.", 403);
      if (body.unmerge) {
        update.parent_ticket_id = null;
        events.push({ note: "Unlinked from master ticket (manual)." });
      } else {
        const { data: target } = await db.from("grievances").select("id, ticket_token, parent_ticket_id, status").eq("ticket_token", body.mergeIntoToken!).maybeSingle();
        if (!target || target.id === id) return jsonError("Master ticket not found.");
        const masterId = target.parent_ticket_id ?? target.id; // never nest clusters
        if (masterId === id) return jsonError("Cannot merge a ticket into its own duplicate.");
        update.parent_ticket_id = masterId;
        update.status = target.status;
        // Children of this ticket move to the new master too.
        await db.from("grievances").update({ parent_ticket_id: masterId }).eq("parent_ticket_id", id);
        events.push({ note: `Merged as duplicate of ticket #${target.ticket_token} (manual).` });
      }
    }

    // ---------------------------------------------------------- status
    if (body.status && body.status !== row.status) {
      if (!allowedTargetStatuses(admin.role).includes(body.status)) return jsonError(`Your role cannot set status "${body.status}".`, 403);
      if (body.status === "Resolved" && !can(admin.role, "tickets.resolve")) return jsonError("You cannot resolve tickets.", 403);
      update.status = body.status;
      update.resolved_at = body.status === "Resolved" ? new Date().toISOString() : null;
      events.push({ from_status: row.status, to_status: body.status, note: body.note ?? null });
    } else if (body.note) {
      events.push({ note: body.note });
    }

    if (body.resolutionNoteHindi !== undefined) {
      update.resolution_note_hindi = body.resolutionNoteHindi || null;
      events.push({ note: `Resolution note updated${body.resolutionNoteHindi ? `: ${body.resolutionNoteHindi}` : " (cleared)"}` });
    }
    if (body.assignedDepartment && can(admin.role, "tickets.resolve")) {
      update.assigned_department = body.assignedDepartment;
      events.push({ note: `Assigned to ${body.assignedDepartment}.` });
    }

    if (!Object.keys(update).length && !events.length) return NextResponse.json({ ok: true });

    if (Object.keys(update).length) {
      const { error } = await db.from("grievances").update(update).eq("id", id);
      if (error) throw new Error(error.message);
      // Keep clustered duplicates in sync so every reporting worker hears the update.
      const childUpdate: Record<string, unknown> = {};
      if ("status" in update) {
        childUpdate.status = update.status;
        childUpdate.resolved_at = update.resolved_at ?? null;
      }
      if ("resolution_note_hindi" in update) childUpdate.resolution_note_hindi = update.resolution_note_hindi;
      if (Object.keys(childUpdate).length && !row.parent_ticket_id) {
        await db.from("grievances").update(childUpdate).eq("parent_ticket_id", id);
      }
    }
    if (events.length) {
      await db.from("grievance_events").insert(events.map((e) => ({ grievance_id: id, actor_admin_id: admin.id, actor_label: actor, ...e })));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, "admin:grievance:patch");
  }
}
