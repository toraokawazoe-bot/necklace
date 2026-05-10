import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-session";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const res = NextResponse.redirect(new URL("/admin/login", url.origin), {
    status: 303,
  });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}

export async function GET(request: Request) {
  return POST(request);
}
