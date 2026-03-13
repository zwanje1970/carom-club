"use client";

import { useCallback, useEffect, useState } from "react";
import { getDisplayName } from "@/lib/display-name";

const TYPE_LABELS: Record<string, string> = {
  VENUE: "당구장",
  CLUB: "동호회",
  FEDERATION: "연맹/협회",
  HOST: "일반 주최자",
  INSTRUCTOR: "선수/강사/코치",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "거절",
};

type Row = {
  id: string;
  type: string;
  status: string;
  organizationName: string;
  applicantName: string;
  phone: string;
  email: string;
  region: string | null;
  shortDescription: string | null;
  referenceLink: string | null;
  rejectedReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  applicant: {
    id: string;
    name: string;
    username: string;
    email: string;
    status?: string | null;
    withdrawnAt?: string | null;
  } | null;
};

export function ClientApplicationsList() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/admin/client-applications");
    if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchList();
      } catch {
        if (!cancelled) setError("목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchList]);

  async function handleAction(
    id: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    rejectedReason?: string | null
  ) {
    setActioning(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/client-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "REJECTED" && rejectedReason !== undefined
            ? { rejectedReason: rejectedReason?.trim() || null }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "처리에 실패했습니다.");
        return;
      }
      try {
        await fetchList();
      } catch {
        setError("목록을 다시 불러오지 못했습니다.");
      }
    } finally {
      setActioning(null);
    }
  }

  function withConfirm(
    message: string,
    onConfirm: () => void
  ) {
    if (window.confirm(message)) onConfirm();
  }

  if (loading) return <p className="text-gray-500">불러오는 중...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (list.length === 0) return <p className="text-gray-500">신청이 없습니다.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
            <th className="p-3 text-left font-medium">유형</th>
            <th className="p-3 text-left font-medium">업체명</th>
            <th className="p-3 text-left font-medium">신청자</th>
            <th className="p-3 text-left font-medium">연락처</th>
            <th className="p-3 text-left font-medium">상태</th>
            <th className="p-3 text-left font-medium">신청일</th>
            <th className="p-3 text-left font-medium">거절사유</th>
            <th className="p-3 text-right font-medium">처리</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.id} className="border-b border-site-border last:border-0">
              <td className="p-3">{TYPE_LABELS[row.type] ?? row.type}</td>
              <td className="p-3">{row.organizationName}</td>
              <td className="p-3">
                {getDisplayName(row.applicant) || row.applicantName}
                {row.applicant && (
                  <span className="ml-1 text-gray-500">({row.applicant.username})</span>
                )}
              </td>
              <td className="p-3">{row.phone}</td>
              <td className="p-3">
                <span className="font-medium">{STATUS_LABELS[row.status] ?? row.status}</span>
              </td>
              <td className="p-3">{new Date(row.createdAt).toLocaleDateString("ko-KR")}</td>
              <td className="p-3 max-w-[200px]">
                {row.status === "REJECTED" && (
                  <span className="text-gray-600 dark:text-slate-400">
                    {row.rejectedReason || "—"}
                  </span>
                )}
              </td>
              <td className="p-3 text-right">
                <span className="flex flex-wrap gap-2 justify-end">
                  {row.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() =>
                          withConfirm("이 신청을 승인하시겠습니까? 업체가 생성되고 신청자가 클라이언트 관리자로 변경됩니다.", () =>
                            handleAction(row.id, "APPROVED")
                          )
                        }
                        className="rounded bg-green-600 px-2 py-1 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        {actioning === row.id ? "처리 중..." : "승인"}
                      </button>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() => {
                          const reason = window.prompt("거절 사유 (선택, 취소 시 빈 값):");
                          if (reason !== null)
                            withConfirm("이 신청을 거절하시겠습니까?", () =>
                              handleAction(row.id, "REJECTED", reason)
                            );
                        }}
                        className="rounded bg-red-600 px-2 py-1 text-white text-xs hover:bg-red-700 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </>
                  )}
                  {row.status === "APPROVED" && (
                    <>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() =>
                          withConfirm("승인을 취소하고 대기(보류)로 되돌리시겠습니까?", () =>
                            handleAction(row.id, "PENDING")
                          )
                        }
                        className="rounded bg-gray-500 px-2 py-1 text-white text-xs hover:bg-gray-600 disabled:opacity-50"
                      >
                        보류로 되돌리기
                      </button>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() => {
                          const reason = window.prompt("거절 사유 (선택):");
                          if (reason !== null)
                            withConfirm("승인을 취소하고 거절로 변경하시겠습니까?", () =>
                              handleAction(row.id, "REJECTED", reason)
                            );
                        }}
                        className="rounded bg-red-600 px-2 py-1 text-white text-xs hover:bg-red-700 disabled:opacity-50"
                      >
                        거절로 변경
                      </button>
                    </>
                  )}
                  {row.status === "REJECTED" && (
                    <>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() =>
                          withConfirm("거절을 취소하고 대기(보류)로 되돌리시겠습니까?", () =>
                            handleAction(row.id, "PENDING")
                          )
                        }
                        className="rounded bg-gray-500 px-2 py-1 text-white text-xs hover:bg-gray-600 disabled:opacity-50"
                      >
                        보류로 되돌리기
                      </button>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() =>
                          withConfirm("이 신청을 승인하시겠습니까? 업체가 생성되고 신청자가 클라이언트 관리자로 변경됩니다.", () =>
                            handleAction(row.id, "APPROVED")
                          )
                        }
                        className="rounded bg-green-600 px-2 py-1 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        승인으로 변경
                      </button>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() => {
                          const newReason = window.prompt("거절사유 수정", row.rejectedReason ?? "");
                          if (newReason !== null)
                            handleAction(row.id, "REJECTED", newReason);
                        }}
                        className="rounded bg-amber-600 px-2 py-1 text-white text-xs hover:bg-amber-700 disabled:opacity-50"
                      >
                        거절사유 수정
                      </button>
                      <button
                        type="button"
                        disabled={!!actioning}
                        onClick={() =>
                          withConfirm("거절사유를 삭제하시겠습니까?", () =>
                            handleAction(row.id, "REJECTED", null)
                          )
                        }
                        className="rounded bg-slate-500 px-2 py-1 text-white text-xs hover:bg-slate-600 disabled:opacity-50"
                      >
                        거절사유 삭제
                      </button>
                    </>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
