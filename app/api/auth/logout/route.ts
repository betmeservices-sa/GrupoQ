import { NextResponse } from "next/server";
import { cookieBorrada } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", cookieBorrada(req.headers.get("host")));
  res.headers.append("Set-Cookie", cookieBorrada());
  return res;
}
