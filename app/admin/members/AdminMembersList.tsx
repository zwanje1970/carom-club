"use client";

import { useEffect, useState } from "react";
import type { MemberRow } from "@/app/api/admin/members/route";

const ROLE_LABELS: Record<string, string> = {
  USER: "일반회원",
  CLIENT_ADMIN: "클라이언트 관리자",
  PLATFORM_ADMIN: "플랫폼 관리자",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "정상",
  DELETED: "탈퇴",
};

const FILTER_OPTIONS = [
  { value: "active", label: "정상" },
  { value: "withdrawn", label: "탈퇴" },
  { value: "all", label: "전체" },
] as const;

export function AdminMembersList() {
  const [list, setList] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "withdrawn">("active");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/admin/members?filter=${filter}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "목록을 불러올 수 없습니다.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  if (loading) return <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>;
  if (error) return <p className="text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-site-text">상태 필터</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "active" | "withdrawn")}
          className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
              <th className="p-3 text-left font-medium text-site-text">이름</th>
              <th className="p-3 text-left font-medium text-site-text">아이디</th>
              <th className="p-3 text-left font-medium text-site-text">이메일</th>
              <th className="p-3 text-left font-medium text-site-text">구분</th>
              <th className="p-3 text-left font-medium text-site-text">상태</th>
              <th className="p-3 text-left font-medium text-site-text">가입일</th>
              <th className="p-3 text-left font-medium text-site-text">탈퇴일</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500 dark:text-slate-400">
                  {filter === "active" && "정상 회원이 없습니다."}
                  {filter === "withdrawn" && "탈퇴 회원이 없습니다."}
                  {filter === "all" && "회원이 없습니다."}
                </td>
              </tr>
            ) : (
              list.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-site-border last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="p-3 text-site-text">{row.name}</td>
                  <td className="p-3 text-site-text">{row.username}</td>
                  <td className="p-3 text-site-text">{row.email}</td>
                  <td className="p-3 text-site-text">
                    {ROLE_LABELS[row.role] ?? row.role}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        row.status === "DELETED" || row.withdrawnAt
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-site-text"
                      }
                    >
                      {STATUS_LABELS[row.status ?? "ACTIVE"] ?? row.status ?? "정상"}
                    </span>
                  </td>
                  <td className="p-3 text-site-text">
                    {new Date(row.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="p-3 text-site-text">
                    {row.withdrawnAt
                      ? new Date(row.withdrawnAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
