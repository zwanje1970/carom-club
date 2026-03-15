"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Zone = { id: string; name: string; code: string | null; sortOrder: number };
type TournamentZoneRow = {
  id: string;
  tournamentId: string;
  zoneId: string;
  name: string | null;
  code: string | null;
  sortOrder: number;
  zone: { id: string; name: string; code: string | null };
};

export function TournamentZonesManager({
  tournamentId,
  initialList,
}: {
  tournamentId: string;
  initialList: TournamentZoneRow[];
}) {
  const router = useRouter();
  const [list, setList] = useState<TournamentZoneRow[]>(initialList);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchZones = useCallback(async () => {
    const res = await fetch("/api/admin/zones");
    if (!res.ok) return;
    const data = await res.json();
    setZones(data);
  }, []);

  useEffect(() => {
    setLoadingZones(true);
    fetchZones().finally(() => setLoadingZones(false));
  }, [fetchZones]);

  const connectedZoneIds = list.map((tz) => tz.zoneId);
  const availableZones = zones.filter((z) => !connectedZoneIds.includes(z.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedZoneId.trim()) {
      setError("권역을 선택해 주세요.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: selectedZoneId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "추가에 실패했습니다.");
        return;
      }
      setList((prev) => [...prev, data]);
      setSelectedZoneId("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tzId: string) {
    if (!confirm("이 대회에서 권역 연결을 해제하시겠습니까?")) return;
    setDeletingId(tzId);
    setError("");
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "제거에 실패했습니다.");
        return;
      }
      setList((prev) => prev.filter((tz) => tz.id !== tzId));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="text-lg font-medium text-site-text">연결된 권역</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">연결된 권역이 없습니다. 아래에서 권역을 추가하세요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((tz) => (
              <li
                key={tz.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-site-border bg-site-bg p-3"
              >
                <span className="font-medium text-site-text">{tz.name || tz.zone.name}</span>
                {tz.zone.code && <span className="text-sm text-gray-500">({tz.zone.code})</span>}
                <button
                  type="button"
                  disabled={!!deletingId}
                  onClick={() => handleRemove(tz.id)}
                  className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  {deletingId === tz.id ? "처리 중..." : "연결 해제"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="text-lg font-medium text-site-text">권역 추가</h2>
        <p className="mt-1 text-sm text-gray-500">
          이 대회에 연결할 권역을 선택하세요. 권역별 예선·본선 운영 시 사용합니다.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {loadingZones ? (
          <p className="mt-3 text-sm text-gray-500">권역 목록 불러오는 중...</p>
        ) : availableZones.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            {zones.length === 0
              ? "등록된 권역이 없습니다. 플랫폼 관리자에게 권역 등록을 요청해 주세요."
              : "이 대회에 연결 가능한 권역이 없습니다. (이미 모두 연결됨)"}
          </p>
        ) : (
          <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">권역</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="rounded border border-site-border px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {availableZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {z.code ? ` (${z.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {adding ? "추가 중..." : "연결"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
