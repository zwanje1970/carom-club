import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/types/auth";
import { listBackupRecords } from "@/lib/backup";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 백업 목록 조회 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }
  try {
    const items = await listBackupRecords(50);
    return NextResponse.json({
      items: items.map((r: { id: string; filename: string; sizeBytes: number; createdAt: Date }) => ({
        id: r.id,
        filename: r.filename,
        sizeBytes: r.sizeBytes,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
