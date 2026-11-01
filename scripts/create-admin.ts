/**
 * Bootstrap the first admin (normally the Dean) — later admins are created
 * from the console's "Admin Users" page.
 *
 *   npm run create-admin -- --email dean@iitr.ac.in --name "Dean of Infrastructure" --password "a-strong-password" --role dean
 *
 * --role: dean | estate_officer | contractor   (contractor also needs --contractor <uuid>)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const fullName = arg("name");
  const password = arg("password");
  const role = arg("role") ?? "dean";
  const contractorId = arg("contractor") ?? null;
  if (!email || !fullName || !password) {
    console.error('Usage: npm run create-admin -- --email you@iitr.ac.in --name "Full Name" --password "min-10-chars" [--role dean]');
    process.exit(1);
  }
  if (!["dean", "estate_officer", "contractor"].includes(role)) throw new Error("Invalid --role");
  if (role === "contractor" && !contractorId) throw new Error("--contractor <agency uuid> is required for contractor accounts");
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: insErr } = await db.from("admin_users").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    contractor_id: role === "contractor" ? contractorId : null,
  });
  if (insErr) {
    await db.auth.admin.deleteUser(data.user.id);
    throw insErr;
  }
  console.log(`Created ${role} account for ${email}. Sign in at /admin/login`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
