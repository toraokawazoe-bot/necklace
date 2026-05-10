export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
};

export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/admin/auth/callback`;
}

export function buildAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: args.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeCodeForToken(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export type GoogleIdTokenClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  exp?: number;
};

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/") + pad, "base64");
}

export function decodeIdToken(idToken: string): GoogleIdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = b64urlToBuf(parts[1]).toString("utf8");
    return JSON.parse(json) as GoogleIdTokenClaims;
  } catch {
    return null;
  }
}
