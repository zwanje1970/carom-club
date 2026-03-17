/**
 * DB 백업: pg_dump 실행 및 파일 저장.
 * DATABASE_URL 필요. pg_dump가 PATH에 있어야 함 (로컬/백업 서버).
 * Vercel 등 서버리스에서는 디스크 쓰기 불가 → 백업 실행 시 /tmp 사용 후 클라이언트로 스트리밍 또는 외부 저장소 연동 필요.
 */
import { spawn } from "child_process";
import { mkdir, writeFile, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), ".backups");

function getFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `backup_${y}_${m}_${day}_${h}${min}${sec}.sql`;
}

export type BackupResult = { id: string; filename: string; filePath: string; sizeBytes: number } | { error: string };

export async function runBackup(): Promise<BackupResult> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) {
    return { error: "DATABASE_URL이 설정되지 않았거나 PostgreSQL이 아닙니다." };
  }
  const filename = getFilename();
  await mkdir(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, filename);

  return new Promise((resolve) => {
    const child = spawn("pg_dump", [url, "-F", "p", "--no-owner", "--no-acl"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (data: Buffer) => console.error("[pg_dump stderr]", data.toString()));
    child.on("error", (err) => {
      resolve({ error: `pg_dump 실행 실패: ${err.message}. pg_dump가 설치되어 있고 PATH에 있는지 확인하세요.` });
    });
    child.on("close", async (code) => {
      if (code !== 0) {
        resolve({ error: `pg_dump가 종료 코드 ${code}로 종료되었습니다.` });
        return;
      }
      const buf = Buffer.concat(chunks);
      try {
        await writeFile(filePath, buf);
        const st = await stat(filePath);
        const record = await prisma.backupRecord.create({
          data: {
            filename,
            filePath,
            sizeBytes: st.size,
          },
        });
        resolve({ id: record.id, filename, filePath, sizeBytes: st.size });
      } catch (e) {
        resolve({ error: e instanceof Error ? e.message : "파일 저장 실패" });
      }
    });
  });
}

export async function getBackupFilePath(recordId: string): Promise<string | null> {
  const record = await prisma.backupRecord.findUnique({
    where: { id: recordId },
    select: { filePath: true },
  });
  return record?.filePath ?? null;
}

export async function listBackupRecords(limit = 50) {
  return prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}