import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/types/auth";
import { getBackupFilePath } from "@/lib/backup";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

/** 백업 파일 다운로드 (로컬 파일이 있을 때만) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await context.params;
  const filePath = await getBackupFilePath(id);
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "백업 파일을 찾을 수 없습니다. 다른 서버에서 생성된 백업일 수 있습니다." }, { status: 404 });
  }
  try {
    const buf = await readFile(filePath);
    const filename = filePath.split(/[/\\]/).pop() || "backup.sql";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "파일 읽기 실패" }, { status: 500 });
  }
}
