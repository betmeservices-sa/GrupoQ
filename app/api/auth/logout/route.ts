import { NextResponse } from "next/server";
import { cookieBorrada } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", cookieBorrada());
  return res;
}
