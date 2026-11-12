import { NextResponse } from "next/server";
import { AUTH_COOKIE, credentials, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const next = String(form.get("next") || "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const base = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? base.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? base.host;
  const origin = `${proto}://${host}`;
  const c = credentials();
  const token = await sessionToken();
  if (!c || !token || form.get("username") !== c.user || form.get("password") !== c.password) {
    return NextResponse.redirect(`${origin}/login?error=1&next=${encodeURIComponent(safeNext)}`, 303);
  }
  const res = NextResponse.redirect(`${origin}${safeNext}`, 303);
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
