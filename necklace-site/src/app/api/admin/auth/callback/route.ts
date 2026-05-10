import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionToken,
  isAllowedAdminEmail,
} from "@/lib/admin-session";
import {
  buildRedirectUri,
  decodeIdToken,
  exchangeCodeForToken,
  getGoogleConfig,
} from "@/lib/google-oauth";

function loginRedirect(origin: string, error: string): NextResponse {
  const target = new URL("/admin/login", origin);
  target.searchParams.set("error", error);
  const res = NextResponse.redirect(target);
  res.cookies.delete("_admin_oauth_state");
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const config = getGoogleConfig();
  if (!config) return loginRedirect(origin, "not_configured");

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) return loginRedirect(origin, "missing_code");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateMatch = cookieHeader.match(/(?:^|;\s*)_admin_oauth_state=([^;]+)/);
  const stateCookie = stateMatch ? decodeURIComponent(stateMatch[1]) : "";
  if (!stateCookie || stateCookie !== stateParam) {
    return loginRedirect(origin, "bad_state");
  }

  let token;
  try {
    token = await exchangeCodeForToken({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: buildRedirectUri(origin),
    });
  } catch (e) {
    console.error("[admin-auth] token exchange failed:", e);
    return loginRedirect(origin, "token_exchange_failed");
  }

  if (!token.id_token) return loginRedirect(origin, "no_id_token");
  const claims = decodeIdToken(token.id_token);
  if (!claims?.email || claims.email_verified === false) {
    return loginRedirect(origin, "no_email");
  }
  if (claims.aud !== config.clientId) {
    return loginRedirect(origin, "bad_audience");
  }
  if (!isAllowedAdminEmail(claims.email)) {
    return loginRedirect(origin, "not_allowed");
  }

  const { token: sessionToken, maxAge } = createSessionToken(claims.email);
  const res = NextResponse.redirect(new URL("/admin", origin));
  res.cookies.delete("_admin_oauth_state");
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
