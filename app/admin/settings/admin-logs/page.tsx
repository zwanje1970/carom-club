"use client";

import { useState, useEffect } from "react";
import { mdiHistory } from "@mdi/js";
import { formatKoreanDateTime } from "@/lib/format-date";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

type LogItem = {
  id: string;
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
};

export default function AdminSettingsAdminLogsPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = targetType ? `?targetType=${targetType}` : "";
    fetch(`/api/admin/admin-logs${params}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [targetType]);

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiHistory} title="관리자 활동 로그" />
      <CardBox className="mb-4">
        <label className="block text-sm mb-1">대상 타입 필터</label>
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-48"
        >
          <option value="">전체</option>
          <option value="notice">공지</option>
          <option value="system_text">시스템 문구</option>
          <option value="site_feature">기능 설정</option>
          <option value="user_role">회원 권한</option>
          <option value="tournament">대회</option>
        </select>
      </CardBox>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800">
                <tr className="border-b border-site-border">
                  <th className="text-left p-2">일시</th>
                  <th className="text-left p-2">관리자</th>
                  <th className="text-left p-2">동작</th>
                  <th className="text-left p-2">대상</th>
                  <th className="text-left p-2">변경 요약</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => (
                  <tr key={log.id} className="border-b border-site-border/50">
                    <td className="p-2 whitespace-nowrap">{formatKoreanDateTime(log.createdAt)}</td>
                    <td className="p-2 font-mono text-xs">{log.adminId.slice(0, 8)}…</td>
                    <td className="p-2">{log.actionType}</td>
                    <td className="p-2">{log.targetType} {log.targetId ? `· ${log.targetId.slice(0, 8)}…` : ""}</td>
                    <td className="p-2 max-w-xs truncate text-gray-600 dark:text-slate-400" title={log.afterValue ?? undefined}>
                      {log.afterValue ? (log.afterValue.length > 60 ? log.afterValue.slice(0, 60) + "…" : log.afterValue) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-4 text-gray-500">기록이 없습니다.</p>}
          </div>
        )}
      </CardBox>
    </SectionMain>
  );
}
