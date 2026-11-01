"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    location.href = "/admin";
  }

  return (
    <div lang="en" className="grid min-h-dvh place-items-center bg-slate-100 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">IIT Roorkee · Estate Office</p>
          <h1 className="text-2xl font-bold text-slate-900">Worker Grievance Console</h1>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />} Sign in
        </button>
        <p className="text-xs text-slate-500">Accounts are created by the Dean of Infrastructure.</p>
      </form>
    </div>
  );
}
