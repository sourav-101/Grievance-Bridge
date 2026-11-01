"use client";
import { KeyRound, Loader2, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ApiError, getJson, sendJson } from "@/lib/client/api";

interface Lookup {
  phone: string;
  worker: { id: string; name: string; age: number | null; workType: string | null; agency: string | null; registeredAt: string } | null;
  credential: { hasPin: boolean; resetPending: boolean; resetExpiresAt: string | null; lockedUntil: string | null; lastResetAt: string | null } | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Estate Office desk: verify a worker in person, then issue a one-time PIN reset code. */
export default function WorkerPinResetPage() {
  const { can } = useAdmin();
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<Lookup | null>(null);
  const [code, setCode] = useState<{ resetCode: string; expiresAt: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("workers.resetPin")) return <p>You do not have permission to reset worker PINs.</p>;

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCode(null);
    setConfirmed(false);
    try {
      setData(await getJson<Lookup>(`/api/admin/workers?phone=${encodeURIComponent(phone)}`));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      setCode(await sendJson<{ resetCode: string; expiresAt: string }>("/api/admin/workers/reset-pin", { phone: data.phone }));
      setData((d) => (d ? { ...d, credential: { hasPin: false, resetPending: true, resetExpiresAt: null, lockedUntil: null, lastResetAt: new Date().toISOString() } } : d));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  const found = data && (data.worker || data.credential);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Worker PIN Reset</h1>
        <p className="text-sm text-slate-500">
          For workers who forgot their PIN or are locked out. Always verify the person in front of you (Aadhaar / contractor ID card)
          before issuing a code — the code lets whoever holds it take over the account.
        </p>
      </div>

      <form onSubmit={lookup} className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 14))}
          inputMode="numeric"
          placeholder="Worker's mobile number"
          aria-label="Worker's mobile number"
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-base"
        />
        <button disabled={busy || phone.replace(/\D/g, "").length < 10} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />} Find
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && !found && <p className="rounded-lg bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">No worker has registered with +91 {data.phone}.</p>}

      {data && found && (
        <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-lg font-semibold" lang="hi">{data.worker?.name ?? "— (profile not completed)"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Mobile</p>
              <p className="font-mono text-lg">+91 {data.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Work / Agency</p>
              <p>{[data.worker?.workType, data.worker?.agency].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">PIN status</p>
              <p>
                {data.credential?.resetPending
                  ? "Reset pending — waiting for worker to use the code"
                  : data.credential?.hasPin
                    ? data.credential.lockedUntil
                      ? `Locked until ${fmt(data.credential.lockedUntil)}`
                      : "PIN set"
                    : "No PIN yet"}
              </p>
              {data.credential?.lastResetAt && <p className="text-xs text-slate-500">Last reset {fmt(data.credential.lastResetAt)}</p>}
            </div>
          </div>

          {!code && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
                I have checked this person&apos;s identity document and they are the owner of this mobile number.
              </label>
              <button
                onClick={reset}
                disabled={!confirmed || busy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <KeyRound className="size-4" aria-hidden /> Reset PIN and issue code
              </button>
              <p className="text-xs text-slate-500">The old PIN stops working immediately. A new code replaces any earlier unused code.</p>
            </div>
          )}

          {code && (
            <div className="space-y-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-900">
                <ShieldAlert className="size-4" aria-hidden /> Give this code to the worker in person. It is shown only once.
              </p>
              <p className="font-mono text-5xl font-bold tracking-[0.3em] text-slate-900">{code.resetCode}</p>
              <p className="text-sm text-slate-600">Valid until {fmt(code.expiresAt)}</p>
              <p className="text-sm" lang="hi">
                मज़दूर को बताएं: “लॉग इन करते समय यह 6 अंकों का कोड दबाएं, फिर अपना नया PIN बनाएं।”
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
