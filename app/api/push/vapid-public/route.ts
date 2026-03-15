import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/vapid";

/**
 * GET /api/push/vapid-public
 * 클라이언트가 Push 구독 시 사용할 VAPID 공개키.
 */
export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "Push not configured." }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
