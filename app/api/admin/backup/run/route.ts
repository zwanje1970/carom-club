import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/types/auth";
import { runBackup } from "@/lib/backup";

/** 백업 실행 (pg_dump). 서버에 pg_dump 필요. */
export async function POST() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const result = await runBackup();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    id: result.id,
    filename: result.filename,
    sizeBytes: result.sizeBytes,
    createdAt: new Date().toISOString(),
  });
}
