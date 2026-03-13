"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PillTag from "./_components/PillTag";
import Button from "./_components/Button";

const STATUS_LABEL: Record<string, string> = {
  APPLIED: "신청됨",
  CONFIRMED: "참가확정",
  REJECTED: "거절",
  CANCELED: "취소",
};

type Entry = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  handicap: string | null;
  avg: string | null;
  depositorName: string | null;
  status: string;
  waitingListOrder: number | null;
  paidAt: string | null;
  attended: boolean | null;
};

export function ParticipantsTable({
  tournamentId,
  entries,
}: {
  tournamentId: string;
  entries: Entry[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function confirmPayment(entryId: string) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function setAbsent(entryId: string) {
    if (!confirm("불참 처리하시겠습니까?")) return;
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/absent`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function setAttendance(entryId: string, attended: boolean) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  function statusColor(s: string): "info" | "warning" | "success" | "danger" | "light" {
    switch (s) {
      case "CONFIRMED":
        return "success";
      case "APPLIED":
        return "warning";
      case "REJECTED":
        return "danger";
      case "CANCELED":
        return "danger";
      default:
        return "light";
    }
  }

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500 dark:text-slate-400">참가자가 없습니다.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              이름
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              핸디
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              AVG
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              입금자명
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              상태
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              출석
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
              작업
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                {e.userName}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                {e.handicap ?? "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                {e.avg ?? "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">{e.depositorName ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                <PillTag color={statusColor(e.status)} label={`${STATUS_LABEL[e.status] ?? e.status}${e.waitingListOrder != null ? ` ${e.waitingListOrder}번` : ""}`} small />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                {e.status === "CONFIRMED" &&
                  (e.attended === null ? (
                    <span className="text-gray-400 dark:text-slate-500">미체크</span>
                  ) : (
                    <span className={e.attended ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {e.attended ? "출석" : "결석"}
                    </span>
                  ))}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                <span className="flex flex-wrap gap-2">
                  {e.status === "APPLIED" && (
                    <Button
                      type="button"
                      label="참가확정"
                      color="info"
                      small
                      disabled={loadingId === e.id}
                      onClick={() => confirmPayment(e.id)}
                    />
                  )}
                  {e.status === "CONFIRMED" && (
                    <>
                      <Button
                        type="button"
                        label="불참"
                        color="danger"
                        small
                        disabled={loadingId === e.id}
                        onClick={() => setAbsent(e.id)}
                      />
                      {e.attended === null && (
                        <>
                          <Button
                            type="button"
                            label="출석"
                            color="success"
                            small
                            disabled={loadingId === e.id}
                            onClick={() => setAttendance(e.id, true)}
                          />
                          <Button
                            type="button"
                            label="결석"
                            color="danger"
                            small
                            outline
                            disabled={loadingId === e.id}
                            onClick={() => setAttendance(e.id, false)}
                          />
                        </>
                      )}
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
