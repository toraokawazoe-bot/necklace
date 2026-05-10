import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildAuthorizeUrl,
  buildRedirectUri,
  getGoogleConfig,
} from "@/lib/google-oauth";

export async function GET(request: Request) {
  const config = getGoogleConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 },
    );
  }
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const state = randomBytes(16).toString("hex");

  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: buildRedirectUri(origin),
    state,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set({
    name: "_admin_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
