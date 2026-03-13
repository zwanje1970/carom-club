"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ClientListRow } from "./page";
import FeeLedgerModal from "./FeeLedgerModal";

const TYPE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "VENUE", label: "당구장" },
  { value: "CLUB", label: "동호회" },
  { value: "FEDERATION", label: "연맹" },
  { value: "INSTRUCTOR", label: "레슨" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  VENUE: "당구장",
  CLUB: "동호회",
  FEDERATION: "연맹",
  INSTRUCTOR: "레슨",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "정상",
  SUSPENDED: "정지",
  EXPELLED: "제명",
};

function formatDate(d: Date | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type Props = { rows: ClientListRow[] };

export default function VenueListTable({ rows }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [remarksEdit, setRemarksEdit] = useState<{ id: string; value: string } | null>(null);
  const [feeLedgerOrg, setFeeLedgerOrg] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  async function updateStatus(orgId: string, status: "ACTIVE" | "SUSPENDED" | "EXPELLED") {
    try {
      const res = await fetch(`/api/admin/venues/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("처리에 실패했습니다.");
    }
  }

  async function saveRemarks(orgId: string, value: string) {
    setRemarksEdit(null);
    try {
      const res = await fetch(`/api/admin/venues/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminRemarks: value || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
          클라이언트 종류
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                유형
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                업체명
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                신청일
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                등록일
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                SLUG
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                비고
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                  등록된 클라이언트가 없습니다. 승인된 신청은 클라이언트 목록에 자동 등록됩니다.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {TYPE_LABELS[row.type] ?? row.type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                    <Link
                      href={`/admin/venues/${row.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={
                        row.status === "EXPELLED"
                          ? "text-red-600 dark:text-red-400"
                          : row.status === "SUSPENDED"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-600 dark:text-slate-400"
                      }
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(row.applicationCreatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400 font-mono">
                    {row.slug}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-sm">
                    {remarksEdit?.id === row.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={remarksEdit.value}
                          onChange={(e) => setRemarksEdit({ id: row.id, value: e.target.value })}
                          onBlur={() => saveRemarks(row.id, remarksEdit.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRemarks(row.id, remarksEdit.value);
                            if (e.key === "Escape") setRemarksEdit(null);
                          }}
                          className="min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemarksEdit({ id: row.id, value: row.adminRemarks ?? "" })}
                        className="block w-full truncate text-left text-gray-600 hover:underline dark:text-slate-400"
                        title="클릭하여 편집"
                      >
                        {row.adminRemarks || "—"}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {row.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "SUSPENDED")}
                          className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          권한 정지
                        </button>
                      )}
                      {row.status === "SUSPENDED" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "ACTIVE")}
                          className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                        >
                          복원
                        </button>
                      )}
                      {row.status !== "EXPELLED" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("제명하면 복원이 어렵습니다. 진행할까요?"))
                              updateStatus(row.id, "EXPELLED");
                          }}
                          className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                        >
                          제명
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFeeLedgerOrg({ id: row.id, name: row.name })}
                        className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        회비 장부
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {feeLedgerOrg && (
        <FeeLedgerModal
          organizationId={feeLedgerOrg.id}
          organizationName={feeLedgerOrg.name}
          onClose={() => setFeeLedgerOrg(null)}
        />
      )}
    </div>
  );
}
