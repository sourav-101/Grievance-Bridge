"use client";
import { CircleAlert, CircleCheck, Loader2, Plus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson, sendJson } from "@/lib/client/api";
import { KNOWLEDGE_CATEGORIES, WORK_TYPE_IDS } from "@/lib/constants";
import type { Contractor, Helpline, KnowledgeItem } from "@/lib/types";

type Tab = "knowledge" | "helplines" | "agencies";

const input = "mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-sm";
const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50";

function useList<T>(url: string, key: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const reload = useCallback(() => {
    getJson<Record<string, T[]>>(url)
      .then((r) => setItems(r[key]))
      .catch(() => setItems([]));
  }, [url, key]);
  useEffect(reload, [reload]);
  return { items, reload };
}

/** Self-service content manager: notices, health camps, wage tables, helplines, agencies. */
export default function ContentPage() {
  const [tab, setTab] = useState<Tab>("knowledge");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Content Manager</h1>
        <p className="text-sm text-slate-500">
          Update what workers hear — no code needed. Items marked <span className="rounded bg-amber-100 px-1 text-amber-800">placeholder</span> still need real data.
        </p>
      </div>
      <div role="tablist" className="inline-flex rounded-lg bg-slate-200 p-1 text-sm">
        {(
          [
            ["knowledge", "Notices & information"],
            ["helplines", "Emergency helplines"],
            ["agencies", "Contractor agencies"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-white shadow" : "text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "knowledge" && <KnowledgeManager />}
      {tab === "helplines" && <HelplineManager />}
      {tab === "agencies" && <AgencyManager />}
    </div>
  );
}

// ------------------------------------------------------------------ knowledge
function KnowledgeManager() {
  const { items, reload } = useList<KnowledgeItem>("/api/admin/content", "items");
  const [editing, setEditing] = useState<Partial<KnowledgeItem> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = items?.filter((i) => !i.has_embedding).length ?? 0;

  async function save() {
    if (!editing) return;
    setBusy(true);
    setMsg(null);
    const body = {
      title: editing.title,
      category: editing.category,
      contentHindi: editing.content_hindi,
      isPublished: editing.is_published ?? true,
      isPlaceholder: editing.is_placeholder ?? false,
      sortOrder: editing.sort_order ?? 100,
    };
    try {
      const r = editing.id
        ? await sendJson<{ embedded: boolean }>(`/api/admin/content/${editing.id}`, body, "PATCH")
        : await sendJson<{ embedded: boolean }>("/api/admin/content", body);
      setMsg(r.embedded === false && editing.id ? "Saved." : r.embedded ? "Saved and indexed for voice search." : "Saved (not yet indexed — check GEMINI_API_KEY).");
      setEditing(null);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this item permanently?")) return;
    try {
      await sendJson(`/api/admin/content/${id}`, undefined, "DELETE");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Delete failed");
    }
    reload();
  }

  async function embedAll() {
    setBusy(true);
    try {
      const r = await sendJson<{ embedded: number; failed: number }>("/api/admin/content/embed", {});
      setMsg(`Indexed ${r.embedded} item(s)${r.failed ? `, ${r.failed} failed` : ""}.`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Indexing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEditing({ category: "Schemes", is_published: true, sort_order: 100 })} className={`${btn} bg-slate-900 text-white`}>
          <Plus className="size-4" aria-hidden /> New item
        </button>
        {missing > 0 && (
          <button onClick={embedAll} disabled={busy} className={`${btn} border border-slate-300 bg-white`}>
            <Sparkles className="size-4" aria-hidden /> Index {missing} item(s) for voice search
          </button>
        )}
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_6rem]">
            <label className="text-sm">
              Title (Hindi)
              <input lang="hi" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input} />
            </label>
            <label className="text-sm">
              Section
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as KnowledgeItem["category"] })} className={input}>
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Order
              <input type="number" value={editing.sort_order ?? 100} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={input} />
            </label>
          </div>
          <label className="block text-sm">
            Content (Hindi — simple spoken language; this is read aloud)
            <textarea lang="hi" rows={6} value={editing.content_hindi ?? ""} onChange={(e) => setEditing({ ...editing, content_hindi: e.target.value })} className={`${input} text-base`} />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> Published
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.is_placeholder ?? false} onChange={(e) => setEditing({ ...editing, is_placeholder: e.target.checked })} /> Still a placeholder
            </label>
            <span className="flex-1" />
            <button onClick={() => setEditing(null)} className={`${btn} border border-slate-300`}>
              Cancel
            </button>
            <button onClick={save} disabled={busy || !editing.title || !editing.content_hindi} className={`${btn} bg-slate-900 text-white`}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Save
            </button>
          </div>
        </div>
      )}

      {!items && <p className="text-slate-500">Loading…</p>}
      {KNOWLEDGE_CATEGORIES.map((cat) => {
        const list = items?.filter((i) => i.category === cat) ?? [];
        if (!list.length) return null;
        return (
          <section key={cat} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold">{cat}</h2>
            <ul className="divide-y divide-slate-100">
              {list.map((i) => (
                <li key={i.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium" lang="hi">
                      {i.title}
                      {i.is_placeholder && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">placeholder</span>}
                      {!i.is_published && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">hidden</span>}
                    </p>
                    <p lang="hi" className="line-clamp-2 text-slate-600">{i.content_hindi}</p>
                  </div>
                  <span title={i.has_embedding ? "Indexed for voice search" : "Not indexed"}>
                    {i.has_embedding ? <CircleCheck className="size-4 text-emerald-600" aria-label="Indexed" /> : <CircleAlert className="size-4 text-amber-500" aria-label="Not indexed" />}
                  </span>
                  <button onClick={() => setEditing(i)} className="text-slate-700 underline">
                    Edit
                  </button>
                  <button onClick={() => remove(i.id)} className="text-red-600 underline">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ helplines
function HelplineManager() {
  const { items, reload } = useList<Helpline>("/api/admin/helplines", "helplines");
  const [editing, setEditing] = useState<Partial<Helpline> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    const body = {
      kind: editing.kind,
      nameHindi: editing.name_hindi,
      nameEnglish: editing.name_english,
      phone: editing.phone,
      instructionsHindi: editing.instructions_hindi,
      isPlaceholder: editing.is_placeholder ?? false,
      sortOrder: editing.sort_order ?? 100,
    };
    try {
      if (editing.id) await sendJson(`/api/admin/helplines/${editing.id}`, body, "PATCH");
      else await sendJson("/api/admin/helplines", body);
      setEditing(null);
      setMsg("Saved.");
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setEditing({ kind: "security", sort_order: 100 })} className={`${btn} bg-slate-900 text-white`}>
          <Plus className="size-4" aria-hidden /> New helpline
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      {editing && (
        <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <label className="text-sm">
            Type
            <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as Helpline["kind"] })} className={input}>
              <option value="security">Security</option>
              <option value="medical">Medical</option>
              <option value="women">Women&apos;s Cell</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            Phone
            <input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Name (Hindi)
            <input lang="hi" value={editing.name_hindi ?? ""} onChange={(e) => setEditing({ ...editing, name_hindi: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Name (English)
            <input value={editing.name_english ?? ""} onChange={(e) => setEditing({ ...editing, name_english: e.target.value })} className={input} />
          </label>
          <label className="text-sm sm:col-span-2">
            Spoken instructions (Hindi)
            <textarea lang="hi" rows={3} value={editing.instructions_hindi ?? ""} onChange={(e) => setEditing({ ...editing, instructions_hindi: e.target.value })} className={input} />
          </label>
          <div className="flex items-center gap-4 text-sm sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.is_placeholder ?? false} onChange={(e) => setEditing({ ...editing, is_placeholder: e.target.checked })} /> Placeholder (hide call button)
            </label>
            <label className="flex items-center gap-2">
              Order <input type="number" value={editing.sort_order ?? 100} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="w-20 rounded border border-slate-300 px-1" />
            </label>
            <span className="flex-1" />
            <button onClick={() => setEditing(null)} className={`${btn} border border-slate-300`}>
              Cancel
            </button>
            <button onClick={save} className={`${btn} bg-slate-900 text-white`}>
              Save
            </button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {items?.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {h.name_english} · <span lang="hi">{h.name_hindi}</span>
                {h.is_placeholder && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">placeholder</span>}
              </p>
              <p className="font-mono text-slate-600">{h.phone}</p>
            </div>
            <button onClick={() => setEditing(h)} className="underline">
              Edit
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this helpline?")) return;
                await sendJson(`/api/admin/helplines/${h.id}`, undefined, "DELETE").catch((e) =>
                  alert(e instanceof ApiError ? e.message : "Delete failed"),
                );
                reload();
              }}
              className="text-red-600 underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ agencies
function AgencyManager() {
  const { items, reload } = useList<Contractor>("/api/admin/contractors", "contractors");
  const [editing, setEditing] = useState<Partial<Contractor> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    const body = {
      agencyName: editing.agency_name,
      contractType: editing.contract_type,
      supervisorName: editing.supervisor_name || null,
      contactPhone: editing.contact_phone,
      isActive: editing.is_active ?? true,
    };
    try {
      if (editing.id) await sendJson(`/api/admin/contractors/${editing.id}`, body, "PATCH");
      else await sendJson("/api/admin/contractors", body);
      setEditing(null);
      setMsg("Saved.");
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setEditing({ contract_type: "Sanitation", is_active: true })} className={`${btn} bg-slate-900 text-white`}>
          <Plus className="size-4" aria-hidden /> New agency
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      {editing && (
        <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <label className="text-sm">
            Agency name
            <input value={editing.agency_name ?? ""} onChange={(e) => setEditing({ ...editing, agency_name: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Contract type
            <select value={editing.contract_type} onChange={(e) => setEditing({ ...editing, contract_type: e.target.value as Contractor["contract_type"] })} className={input}>
              {WORK_TYPE_IDS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Supervisor
            <input value={editing.supervisor_name ?? ""} onChange={(e) => setEditing({ ...editing, supervisor_name: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Contact phone
            <input value={editing.contact_phone ?? ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} className={input} />
          </label>
          <div className="flex items-center gap-4 text-sm sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active (shown to workers at sign-up)
            </label>
            <span className="flex-1" />
            <button onClick={() => setEditing(null)} className={`${btn} border border-slate-300`}>
              Cancel
            </button>
            <button onClick={save} className={`${btn} bg-slate-900 text-white`}>
              Save
            </button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {items?.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {c.agency_name} {!c.is_active && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">inactive</span>}
              </p>
              <p className="text-slate-600">
                {c.contract_type} · {c.supervisor_name ?? "—"} · {c.contact_phone}
              </p>
            </div>
            <button onClick={() => setEditing(c)} className="underline">
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
