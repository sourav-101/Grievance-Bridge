/**
 * Diagnose configuration / connectivity problems.
 *   npm run check:setup
 * Reads .env.local and checks: env values, Supabase URL format, DNS, HTTPS
 * reachability, service-role key, required tables, storage buckets and later migrations (0004, 0005).
 */
import { config } from "dotenv";
import { lookup } from "node:dns/promises";

config({ path: ".env.local" });
config();

const ok = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string, hint?: string) => {
  console.log(`  ❌ ${m}`);
  if (hint) console.log(`     → ${hint}`);
  failures++;
};
let failures = 0;

function describeFetchError(e: unknown): string {
  const err = e as { message?: string; cause?: { code?: string; message?: string } };
  const code = err.cause?.code ?? "";
  const detail = `${err.message ?? e}${code ? ` (${code})` : ""}${err.cause?.message && !code ? ` – ${err.cause.message}` : ""}`;
  const hints: Record<string, string> = {
    ENOTFOUND: "The hostname does not exist. Check NEXT_PUBLIC_SUPABASE_URL for typos, or your DNS / network.",
    EAI_AGAIN: "DNS lookup failed. Check your internet connection or DNS settings.",
    ECONNREFUSED: "Connection refused. A firewall or proxy may be blocking it.",
    ETIMEDOUT: "Connection timed out. Campus/office networks often block or proxy outgoing traffic — try a mobile hotspot to confirm.",
    UND_ERR_CONNECT_TIMEOUT: "Connection timed out. Campus/office networks often block or proxy outgoing traffic — try a mobile hotspot to confirm.",
    ENETUNREACH: "Network unreachable (often an IPv6 problem). Try: set NODE_OPTIONS=--dns-result-order=ipv4first and restart.",
    SELF_SIGNED_CERT_IN_CHAIN: "A network proxy is intercepting HTTPS. Set NODE_EXTRA_CA_CERTS to your proxy's certificate, or use another network.",
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "A network proxy is intercepting HTTPS. Set NODE_EXTRA_CA_CERTS to your proxy's certificate, or use another network.",
    CERT_HAS_EXPIRED: "Your computer's date/time may be wrong, or a proxy is intercepting HTTPS.",
  };
  return hints[code] ? `${detail}\n     → ${hints[code]}` : detail;
}

async function main() {
  console.log(`\nNode ${process.version}\n`);

  // ---------------------------------------------------------------- env values
  console.log("1. Environment (.env.local)");
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WORKER_SESSION_SECRET"];
  for (const k of required) {
    const v = process.env[k];
    if (!v || v.startsWith("YOUR_")) bad(`${k} is not set`, "Fill it in .env.local, then restart `npm run dev` (env changes need a restart).");
    else ok(`${k} is set`);
  }
  if ((process.env.WORKER_SESSION_SECRET ?? "").length < 32) bad("WORKER_SESSION_SECRET is shorter than 32 characters");
  console.log(`  ℹ️  AUTH_MODE=${process.env.AUTH_MODE || "pin (default)"}`);

  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let url: URL | null = null;
  try {
    url = new URL(raw.trim());
  } catch {
    bad(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${raw}"`, 'It should look like https://abcdefghijklmnop.supabase.co');
  }
  if (url) {
    if (raw !== raw.trim()) bad("NEXT_PUBLIC_SUPABASE_URL has leading/trailing spaces");
    if (url.protocol !== "https:") bad(`URL uses ${url.protocol} — must be https:`);
    if (url.pathname !== "/" && url.pathname !== "") bad(`URL has a path "${url.pathname}"`, "Use only the project URL, e.g. https://abcd.supabase.co (no /rest/v1, no dashboard link).");
    if (url.hostname.includes("supabase.com")) bad("This looks like the dashboard URL (supabase.com)", "Use Project Settings → API → Project URL (….supabase.co).");
    if (/["']/.test(raw)) bad("URL contains quote characters", "Remove the quotes around the value in .env.local.");
  }
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (service && service === anon) bad("SUPABASE_SERVICE_ROLE_KEY is the same as the anon key", "Copy the *service_role* (secret) key from Project Settings → API.");

  if (!url || failures) return finish();
  const base = `${url.protocol}//${url.host}`;

  // ---------------------------------------------------------------- DNS + HTTPS
  console.log("\n2. Network");
  try {
    const addrs = await lookup(url.hostname, { all: true });
    ok(`DNS ${url.hostname} → ${addrs.map((a) => a.address).join(", ")}`);
  } catch (e) {
    bad(`DNS lookup failed for ${url.hostname}: ${(e as Error).message}`, "Check the URL spelling, or your network/DNS. On a campus network try a mobile hotspot.");
    return finish();
  }
  try {
    const r = await fetch(`${base}/auth/v1/health`, { headers: { apikey: anon }, signal: AbortSignal.timeout(15000) });
    ok(`HTTPS to Supabase works (auth health: ${r.status})`);
  } catch (e) {
    bad(`Cannot reach ${base}: ${describeFetchError(e)}`);
    return finish();
  }

  // ---------------------------------------------------------------- keys + tables
  console.log("\n3. Database");
  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  for (const table of ["workers", "grievances", "knowledge_base", "worker_credentials"]) {
    try {
      const r = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers, signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      if (r.ok) ok(`table ${table} reachable`);
      else if (r.status === 401 || /JWT|Invalid API key/i.test(body)) {
        bad(`service-role key rejected (${r.status})`, "Re-copy SUPABASE_SERVICE_ROLE_KEY from Project Settings → API.");
        break;
      } else if (r.status === 404 || /does not exist|PGRST205|42P01/.test(body)) {
        bad(`table ${table} not found`, table === "worker_credentials" ? "Run supabase/migrations/0002_pin_auth.sql in the SQL Editor." : "Run supabase/migrations/0001_init.sql in the SQL Editor.");
      } else bad(`table ${table}: HTTP ${r.status} ${body.slice(0, 150)}`);
    } catch (e) {
      bad(`query ${table} failed: ${describeFetchError(e)}`);
    }
  }

  // ---------------------------------------------------------------- storage
  console.log("\n4. Storage");
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "worker-audio-vault";
  try {
    const r = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers, signal: AbortSignal.timeout(15000) });
    if (r.ok) {
      const b = (await r.json()) as { public?: boolean };
      ok(`bucket ${bucket} exists (${b.public ? "PUBLIC — should be private!" : "private"})`);
    } else bad(`bucket ${bucket} not found (${r.status})`, "Run 0001_init.sql (it creates the bucket), or create a private bucket with this name in Storage.");
  } catch (e) {
    bad(`storage check failed: ${describeFetchError(e)}`);
  }
  const photoBucket = process.env.SUPABASE_PHOTO_BUCKET || "worker-photo-vault";
  try {
    const r = await fetch(`${base}/storage/v1/bucket/${photoBucket}`, { headers, signal: AbortSignal.timeout(15000) });
    if (r.ok) {
      const b = (await r.json()) as { public?: boolean };
      ok(`bucket ${photoBucket} exists (${b.public ? "PUBLIC — should be private!" : "private"})`);
    } else bad(`bucket ${photoBucket} not found (${r.status})`, "Run supabase/migrations/0004_photos.sql in the SQL Editor.");
  } catch (e) {
    bad(`storage check failed: ${describeFetchError(e)}`);
  }

  // ---------------------------------------------------------------- later migrations
  console.log("\n5. Later migrations");
  const columns: [table: string, column: string, migration: string][] = [
    ["grievances", "photo_url", "0004_photos.sql"],
    ["knowledge_base", "content_english", "0005_english_content.sql"],
    ["helplines", "instructions_english", "0005_english_content.sql"],
  ];
  for (const [table, column, migration] of columns) {
    try {
      const r = await fetch(`${base}/rest/v1/${table}?select=${column}&limit=1`, { headers, signal: AbortSignal.timeout(15000) });
      if (r.ok) ok(`${table}.${column} exists`);
      else bad(`${table}.${column} is missing`, `Run supabase/migrations/${migration} in the SQL Editor.`);
    } catch (e) {
      bad(`column check failed: ${describeFetchError(e)}`);
    }
  }
  // 0003 widens a CHECK constraint, which the REST API can't inspect; saving English as a
  // worker's language fails with a constraint error until it has been run.
  console.log("  (also run 0003_english.sql if you have not — it lets workers save English as their language)");
  finish();
}

function finish() {
  console.log(failures ? `\n${failures} problem(s) found.\n` : "\nAll checks passed.\n");
  process.exit(failures ? 1 : 0);
}

main();
