import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 웹푸시 구독 API — 비활성화(웹뷰 앱 + FCM 앱푸시로 전환).
 * 라우트 파일은 유지하며 저장 로직은 호출하지 않음.
 */
export async function POST() {
  return NextResponse.json(
    { error: "웹푸시 구독은 사용하지 않습니다. 앱 푸시(FCM)로 전환 예정입니다." },
    { status: 410 }
  );
}
