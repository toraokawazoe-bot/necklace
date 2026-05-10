import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";

const VISITOR_COOKIE = "_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function newVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(request: Request) {
  let body: { path?: unknown; referrer?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const path = typeof body.path === "string" ? body.path : "/";
  const referrer = typeof body.referrer === "string" ? body.referrer : null;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)_vid=([^;]+)/);
  let visitorId = match ? decodeURIComponent(match[1]) : "";
  let setCookie = false;
  if (!visitorId) {
    visitorId = newVisitorId();
    setCookie = true;
  }

  const url = new URL(request.url);
  await track({
    path,
    referrer,
    visitorId,
    ownHost: url.hostname,
  });

  const res = NextResponse.json({ ok: true });
  if (setCookie) {
    res.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return res;
}
