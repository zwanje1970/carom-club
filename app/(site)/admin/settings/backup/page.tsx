"use client";

import { useState, useEffect } from "react";
import { mdiDatabaseExport } from "@mdi/js";
import { formatKoreanDateTime } from "@/lib/format-date";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type BackupItem = { id: string; filename: string; sizeBytes: number | null; createdAt: string };

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminSettingsBackupPage() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/backup")
      .then((res) => res.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runBackup = async () => {
    setRunning(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/backup/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "백업 실행 실패");
        return;
      }
      setSuccess(`백업 완료: ${data.filename}`);
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("백업 요청 실패");
    } finally {
      setRunning(false);
    }
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiDatabaseExport} title="데이터 백업" />

      <CardBox className="mb-6">
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          사용자·대회·커뮤니티·시스템 설정을 포함한 DB 전체를 SQL 파일로 백업합니다. 서버에 <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">pg_dump</code>가 설치되어 있어야 합니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            label={running ? "백업 실행 중…" : "백업 실행"}
            color="info"
            onClick={runBackup}
            disabled={running}
          />
          {error && <NotificationBar color="danger">{error}</NotificationBar>}
          {success && <NotificationBar color="success">{success}</NotificationBar>}
        </div>
      </CardBox>

      <CardBox className="mb-6">
        <h3 className="font-semibold mb-3">백업 목록</h3>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border">
                  <th className="text-left p-2">파일명</th>
                  <th className="text-left p-2">크기</th>
                  <th className="text-left p-2">생성일시</th>
                  <th className="p-2">동작</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-site-border/50">
                    <td className="p-2 font-mono text-xs">{r.filename}</td>
                    <td className="p-2">{formatBytes(r.sizeBytes)}</td>
                    <td className="p-2">{formatKoreanDateTime(r.createdAt)}</td>
                    <td className="p-2">
                      <a
                        href={`/api/admin/backup/${r.id}/download`}
                        download={r.filename}
                        className="text-site-primary hover:underline"
                      >
                        다운로드
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-4 text-gray-500">백업 내역이 없습니다. 위에서 백업 실행을 눌러 주세요.</p>}
          </div>
        )}
      </CardBox>

      <CardBox>
        <h3 className="font-semibold mb-2">복원 안내</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
          백업 파일(.sql) 복원은 서버에서 수동으로 진행하세요. 데이터가 덮어쓰이므로 반드시 신중히 실행하세요.
        </p>
        <pre className="bg-gray-100 dark:bg-slate-800 rounded-lg p-3 text-xs overflow-x-auto">
          {`# 백업 파일 다운로드 후 서버에서:
psql $DATABASE_URL -f backup_2026_03_16_120000.sql

# 또는 drop 후 복원 (전체 교체)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $DATABASE_URL -f backup_2026_03_16_120000.sql`}
        </pre>
      </CardBox>

      <CardBox className="mt-6">
        <h3 className="font-semibold mb-2">일일 자동 백업</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          크론에서 아래 URL을 호출하면 자동 백업이 실행됩니다. <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">.env</code>에 <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">BACKUP_CRON_SECRET</code>을 설정한 뒤, 동일한 값을 쿼리로 전달하세요.
        </p>
        <pre className="mt-2 bg-gray-100 dark:bg-slate-800 rounded-lg p-3 text-xs overflow-x-auto">
          GET /api/admin/backup/cron?secret=YOUR_SECRET
        </pre>
      </CardBox>
    </SectionMain>
  );
}
