import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isNaverMapConfigured } from "@/lib/integration-settings";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const naverMapConfigured = await isNaverMapConfigured();
  return NextResponse.json({ naverMapConfigured });
}
