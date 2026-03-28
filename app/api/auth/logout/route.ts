import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { clearClientConsoleOrgCookie } from "@/lib/client-console-org.server";

export async function POST() {
  await clearSessionCookie();
  await clearClientConsoleOrgCookie();
  return NextResponse.json({ ok: true });
}
