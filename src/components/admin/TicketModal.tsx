"use client";
import { TriangleAlert, EyeOff, Loader2, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson, sendJson } from "@/lib/client/api";
import { DIALECTS, isDialect } from "@/lib/constants";
import { allowedTargetStatuses } from "@/lib/auth/rbac";
import type { GrievanceEvent, GrievanceStatus } from "@/lib/types";
import { useAdmin } from "./AdminProvider";
import { CATEGORY_STYLE, timeAgo, type TicketCard } from "./types";

interface Detail {
  ticket: TicketCard;
  audioUrl: string | null;
  photoUrl?: string | null;
  duplicates: (TicketCard & { audioUrl: string | null; photoUrl?: string | null })[];
  parent: { id: string; ticket_token: string; status: string } | null;
  events: GrievanceEvent[];
  feedback: { rating: string; transcript: string | null; createdAt: string; audioUrl: string | null } | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Ticket detail: in-browser audio player, Hindi transcript, English summary, actions. */
export function TicketModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { admin, can } = useAdmin();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<GrievanceStatus>("New");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [department, setDepartment] = useState("");
  const [mergeToken, setMergeToken] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await getJson<Detail>(`/api/admin/grievances/${id}`);
      setD(r);
      setStatus(r.ticket.status);
      setResolution(r.ticket.resolutionNoteHindi ?? "");
      setDepartment(r.ticket.assignedDepartment);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load ticket");
    }
  }, [id]);

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, onClose]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await sendJson(`/api/admin/grievances/${id}`, body, "PATCH");
      setNote("");
      setMergeToken("");
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  function previewSpoken() {
    if (typeof speechSynthesis === "undefined" || !resolution) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(resolution);
    u.lang = "hi-IN";
    speechSynthesis.speak(u);
  }

  const t = d?.ticket;
  const canResolveFields = can("tickets.resolve");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ticket detail"
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <p className="font-mono text-sm text-slate-500">
              Ticket #{t?.token ?? "…"} {t && <span className="text-slate-400">· internal no. {t.ticketNumber}</span>}
            </p>
            {t && <p className="text-lg font-semibold">{t.location}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {!d && !error && <p className="p-8 text-center text-slate-500">Loading…</p>}
        {error && <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {t && d && (
          <div className="space-y-6 p-5">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[t.category]}`}>{t.category}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{t.status}</span>
              {t.isEmergency && (
                <span className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  <TriangleAlert className="size-3" aria-hidden /> EMERGENCY {t.emergencyKeywords.length > 0 && `(${t.emergencyKeywords.join(", ")})`}
                </span>
              )}
              {t.isAnonymous && (
                <span className="flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  <EyeOff className="size-3" aria-hidden /> Anonymous — identity &amp; voice withheld
                </span>
              )}
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                Filed {timeAgo(t.createdAt)} via {t.source} · {isDialect(t.dialect) ? DIALECTS[t.dialect].labelEn : t.dialect}
              </span>
            </div>

            {d.parent && (
              <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
                This is a duplicate of master ticket #{d.parent.ticket_token} ({d.parent.status}).
              </p>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">English summary</h3>
              <p className="text-base">{t.summaryEnglish}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Worker&apos;s words (Hindi transcript)</h3>
              <p lang="hi" className="rounded-lg bg-amber-50 p-3 text-lg leading-relaxed">{t.transcriptHindi}</p>
              {d.audioUrl ? (
                <audio controls preload="none" src={d.audioUrl} className="w-full">
                  <track kind="captions" />
                </audio>
              ) : (
                <p className="text-xs text-slate-500">{t.isAnonymous ? "Voice recording deleted to protect the whistleblower." : "No voice note (filed by tapping icons)."}</p>
              )}
            </section>

            {t.hasPhoto && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Photo from the worker</h3>
                {d.photoUrl ? (
                  <a href={d.photoUrl} target="_blank" rel="noreferrer" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.photoUrl} alt="Photo of the reported problem" className="max-h-80 w-full rounded-lg bg-slate-100 object-contain ring-1 ring-slate-200" />
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">Photo could not be loaded.</p>
                )}
                <p className="text-xs text-slate-500">Private photo · link valid for 10 minutes · click to open full size.</p>
              </section>
            )}

            <section className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Reported by</p>
                {t.worker ? (
                  <p>
                    {t.worker.name} · {t.worker.phone} {t.worker.workType && `· ${t.worker.workType}`}
                  </p>
                ) : (
                  <p className="text-slate-500">{t.isAnonymous ? "Anonymous" : "Hidden for your role"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Agency</p>
                <p>{t.contractorName ?? "Not linked"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Department</p>
                <p>{t.assignedDepartment}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Resolved</p>
                <p>{t.resolvedAt ? fmt(t.resolvedAt) : "—"}</p>
              </div>
            </section>

            {d.duplicates.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Clustered duplicate reports ({d.duplicates.length})</h3>
                <ul className="space-y-2">
                  {d.duplicates.map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-mono text-xs text-slate-500">
                        #{c.token} · {timeAgo(c.createdAt)} {c.isAnonymous && "· anonymous"}
                      </p>
                      <p>{c.summaryEnglish}</p>
                      <p lang="hi" className="text-slate-600">{c.transcriptHindi}</p>
                      {c.audioUrl && <audio controls preload="none" src={c.audioUrl} className="mt-1 h-8 w-full" />}
                      {c.photoUrl && (
                        <a href={c.photoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.photoUrl} alt="Photo of the reported problem" className="mt-1 h-24 rounded object-cover ring-1 ring-slate-200" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {d.feedback && (
              <section className={`rounded-lg p-3 text-sm ${d.feedback.rating === "Satisfied" ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="font-semibold">Worker feedback: {d.feedback.rating}</p>
                {d.feedback.transcript && <p lang="hi">“{d.feedback.transcript}”</p>}
                {d.feedback.audioUrl && <audio controls preload="none" src={d.feedback.audioUrl} className="mt-1 h-8 w-full" />}
              </section>
            )}

            {/* ------------------------------------------------ actions */}
            <section className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold">Update ticket</h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GrievanceStatus)}
                    className="mt-1 block h-10 rounded-lg border border-slate-300 px-2"
                  >
                    {Array.from(new Set([t.status, ...allowedTargetStatuses(admin.role)])).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-48 flex-1 text-sm">
                  Internal note (optional)
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-2" />
                </label>
                <button
                  disabled={saving || (status === t.status && !note)}
                  onClick={() => patch({ status: status === t.status ? undefined : status, note: note || undefined })}
                  className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
                </button>
              </div>

              <label className="block text-sm">
                Message to worker (Hindi) — read aloud in their &quot;My History&quot; and status checks
                <textarea
                  lang="hi"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={3}
                  placeholder="जैसे: गोविंद भवन में पानी की मोटर ठीक कर दी गई है।"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-base"
                />
              </label>
              <div className="flex gap-2">
                <button onClick={previewSpoken} className="flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm">
                  <Volume2 className="size-4" aria-hidden /> Preview
                </button>
                <button
                  disabled={saving || resolution === (t.resolutionNoteHindi ?? "")}
                  onClick={() => patch({ resolutionNoteHindi: resolution || null })}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save message
                </button>
              </div>

              {canResolveFields && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-48 flex-1 text-sm">
                    Assigned department
                    <input value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-2" />
                  </label>
                  <button
                    disabled={saving || department === t.assignedDepartment}
                    onClick={() => patch({ assignedDepartment: department })}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50"
                  >
                    Reassign
                  </button>
                </div>
              )}

              {can("tickets.merge") && (
                <div className="flex flex-wrap items-end gap-2">
                  {t.parentTicketId ? (
                    <button onClick={() => patch({ unmerge: true })} disabled={saving} className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold">
                      Unlink from master ticket
                    </button>
                  ) : (
                    <>
                      <label className="text-sm">
                        Merge as duplicate of token
                        <input
                          value={mergeToken}
                          onChange={(e) => setMergeToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          placeholder="e.g. 4821"
                          className="mt-1 block h-10 w-32 rounded-lg border border-slate-300 px-2 font-mono"
                        />
                      </label>
                      <button
                        disabled={saving || mergeToken.length < 4}
                        onClick={() => patch({ mergeIntoToken: mergeToken })}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50"
                      >
                        Merge
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h3>
              <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm">
                {d.events.map((e) => (
                  <li key={e.id}>
                    <p className="text-xs text-slate-500">
                      {fmt(e.created_at)} · {e.actor_label}
                    </p>
                    {e.to_status && (
                      <p className="font-medium">
                        {e.from_status ? `${e.from_status} → ` : ""}
                        {e.to_status}
                      </p>
                    )}
                    {e.note && <p className="text-slate-700">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
