import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type Session = { email: string; exp: number };

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be set to a random string >=16 chars",
    );
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

export function createSessionToken(email: string): {
  token: string;
  maxAge: number;
} {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payloadJson = JSON.stringify({ email, exp } satisfies Session);
  const payload = b64url(payloadJson);
  const sig = sign(payload);
  return { token: `${payload}.${sig}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(b64urlDecode(payload).toString("utf8")) as Session;
    if (typeof session.email !== "string" || typeof session.exp !== "number") {
      return null;
    }
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token);
}

export function isAllowedAdminEmail(email: string): boolean {
  const allow = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!allow) return false;
  return email.trim().toLowerCase() === allow;
}
