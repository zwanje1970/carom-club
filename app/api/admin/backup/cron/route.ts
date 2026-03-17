import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";

/**
 * 일일 자동 백업용. 크론에서 호출.
 * 쿼리: ?secret=xxx (BACKUP_CRON_SECRET과 일치해야 함)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expected = process.env.BACKUP_CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runBackup();
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id, filename: result.filename });
}
