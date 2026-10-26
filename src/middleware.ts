import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Refreshes the Supabase session cookies and routes by role (app_metadata.role, kept in sync by SQL). */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const role = user?.app_metadata?.role as string | undefined;
  const { pathname } = req.nextUrl;

  const redirectTo = (path: string) => {
    const r = NextResponse.redirect(new URL(path, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };
  const home = role === "ADMIN" || role === "WORKER" ? "/admin" : role === "CLIENT" ? "/client" : null;

  if (pathname.startsWith("/admin")) {
    if (!user) return redirectTo(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    if (role !== "ADMIN" && role !== "WORKER") return redirectTo(home ?? "/login");
  }
  if (pathname.startsWith("/client")) {
    if (!user) return redirectTo(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    if (role !== "CLIENT") return redirectTo(home ?? "/login");
  }
  // `expired`: session is valid but its profile no longer exists — let the login page clear it.
  if (pathname === "/login" && home && !req.nextUrl.searchParams.has("expired")) return redirectTo(home);
  return res;
}

export const config = { matcher: ["/admin/:path*", "/client/:path*", "/login"] };
