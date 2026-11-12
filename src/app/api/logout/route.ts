import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const base = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? base.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? base.host;
  const res = NextResponse.redirect(`${proto}://${host}/login`, 303);
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
