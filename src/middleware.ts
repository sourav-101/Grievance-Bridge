import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { WORKER_COOKIE, verifyWorkerSession } from "@/lib/auth/session-token";

/**
 * Page-level routing guard.
 *   /admin/*  → Supabase Auth session (refreshes cookies), else /admin/login
 *   others    → worker OTP session, else /login; no profile yet → /onboarding
 * API routes enforce their own auth.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin")) return adminGuard(req);
  return workerGuard(req);
}

async function workerGuard(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifyWorkerSession(req.cookies.get(WORKER_COOKIE)?.value);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (pathname === "/login") {
    if (session?.workerId) return to("/");
    if (session) return to("/onboarding");
    return NextResponse.next();
  }
  if (!session) return to(`/login?next=${encodeURIComponent(pathname + search)}`);
  if (!session.workerId && pathname !== "/onboarding") return to("/onboarding");
  if (session.workerId && pathname === "/onboarding") return to("/");
  return NextResponse.next();
}

async function adminGuard(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || url.includes("YOUR_")) return NextResponse.next(); // misconfigured: let the page show the error

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = req.nextUrl.pathname === "/admin/login";
  if (!user && !isLogin) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (user && isLogin) return NextResponse.redirect(new URL("/admin", req.url));
  return response;
}

export const config = {
  // Public assets (logo, banner, photos) must load on the login and onboarding pages too,
  // so anything under /images/ or with a static-file extension skips the guard.
  matcher: [
    "/((?!api|_next/static|_next/image|images/|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
