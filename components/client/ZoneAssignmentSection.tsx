"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ZoneAssignment = {
  id: string;
  tournamentZoneId: string;
  zoneName: string;
  zoneCode: string | null;
  assignmentType: string;
  assignedAt: string;
  notes: string | null;
};

type EntryRow = {
  id: string;
  userId: string;
  userName: string;
  handicap: string | null;
  avg: string | null;
  status: string;
  zoneAssignment: ZoneAssignment | null;
};

type TournamentZoneRow = {
  id: string;
  name: string;
  code: string | null;
  zoneId: string;
};

type ZoneCount = {
  tournamentZoneId: string;
  zoneName: string;
  zoneCode: string | null;
  count: number;
};

type Data = {
  tournamentId: string;
  entries: EntryRow[];
  tournamentZones: TournamentZoneRow[];
  unassignedCount: number;
  zoneCounts: ZoneCount[];
};

export function ZoneAssignmentSection({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/zone-assignments`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tournamentId]);

  async function assign(entryId: string, tournamentZoneId: string) {
    setAssigning(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/zone-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, tournamentZoneId, assignmentType: "MANUAL" }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "배정 실패");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setAssigning(null);
    }
  }

  async function unassign(assignmentId: string) {
    if (!confirm("이 참가자의 권역 배정을 해제하시겠습니까?")) return;
    setUnassigning(assignmentId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/zone-assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "해제 실패");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setUnassigning(null);
    }
  }

  async function autoAssign() {
    setAutoAssigning(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/zone-assignments/auto`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "자동 배정 실패");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setAutoAssigning(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="text-lg font-semibold text-site-text">권역 배정</h2>
        <p className="mt-2 text-sm text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-site-border bg-site-card p-6">
      <h2 className="text-lg font-semibold text-site-text">권역 배정</h2>
      <p className="mt-1 text-xs text-gray-500">
        참가자를 대회별 권역(TournamentZone)에 배정합니다. 권역은 부/권역 설정에서 연결할 수 있습니다.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-site-border pb-4">
        <span className="text-sm font-medium text-site-text">
          미배정 <span className="text-amber-600 dark:text-amber-400">{data.unassignedCount}명</span>
        </span>
        {data.zoneCounts.map((zc) => (
          <span key={zc.tournamentZoneId} className="text-sm text-gray-600 dark:text-slate-400">
            {zc.zoneName}
            {zc.zoneCode && ` (${zc.zoneCode})`}: <strong>{zc.count}명</strong>
          </span>
        ))}
        <button
          type="button"
          onClick={autoAssign}
          disabled={autoAssigning || data.tournamentZones.length === 0 || data.unassignedCount === 0}
          className="rounded bg-site-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {autoAssigning ? "처리 중..." : "미배정 자동 배정"}
        </button>
      </div>

      {data.tournamentZones.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          권역이 없습니다. <strong>부/권역</strong> 탭에서 대회에 권역을 연결한 뒤 배정할 수 있습니다.
        </p>
      ) : data.entries.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">참가자가 없습니다.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-site-border text-left">
                <th className="pb-2 font-medium text-site-text">이름</th>
                <th className="pb-2 font-medium text-site-text">소속/핸디</th>
                <th className="pb-2 font-medium text-site-text">현재 권역</th>
                <th className="pb-2 font-medium text-site-text">배정</th>
                <th className="pb-2 font-medium text-site-text">액션</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-b border-site-border/50">
                  <td className="py-2 font-medium">{e.userName}</td>
                  <td className="py-2 text-gray-600 dark:text-slate-400">
                    {[e.handicap, e.avg].filter(Boolean).join(" / ") || "-"}
                  </td>
                  <td className="py-2">
                    {e.zoneAssignment ? (
                      <span>
                        {e.zoneAssignment.zoneName}
                        {e.zoneAssignment.zoneCode && ` (${e.zoneAssignment.zoneCode})`}
                        <span className="ml-1 text-gray-400">{e.zoneAssignment.assignmentType === "AUTO" ? "자동" : "수동"}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">미배정</span>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      className="rounded border border-site-border bg-white px-2 py-1 text-sm dark:bg-slate-800"
                      value={e.zoneAssignment?.tournamentZoneId ?? ""}
                      onChange={(ev) => {
                        const tzId = ev.target.value;
                        if (tzId) assign(e.id, tzId);
                        else if (e.zoneAssignment) unassign(e.zoneAssignment.id);
                      }}
                      disabled={assigning === e.id || unassigning === e.zoneAssignment?.id}
                    >
                      <option value="">미배정</option>
                      {data.tournamentZones.map((tz) => (
                        <option key={tz.id} value={tz.id}>
                          {tz.name}
                          {tz.code ? ` (${tz.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    {e.zoneAssignment && (
                      <button
                        type="button"
                        onClick={() => unassign(e.zoneAssignment!.id)}
                        disabled={unassigning === e.zoneAssignment!.id}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        {unassigning === e.zoneAssignment!.id ? "처리 중" : "배정 해제"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
