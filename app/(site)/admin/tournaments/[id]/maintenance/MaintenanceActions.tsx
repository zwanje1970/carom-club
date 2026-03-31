"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tournamentId: string;
  currentStage: string;
  stages: readonly string[];
  stageLabels: Record<string, string>;
  hasZoneMatches: boolean;
  hasQualifiers: boolean;
  hasFinalMatches: boolean;
};

export function MaintenanceActions({
  tournamentId,
  currentStage,
  stages,
  stageLabels,
  hasZoneMatches,
  hasQualifiers,
  hasFinalMatches,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [stageSelect, setStageSelect] = useState(currentStage);

  async function runAction(action: string, body?: Record<string, unknown>) {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { action }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "실패");
        return;
      }
      alert(data.message || "완료");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-site-border bg-site-card p-6">
      <h2 className="text-lg font-semibold text-site-text">작업</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-site-border p-4">
          <h3 className="mb-2 font-medium">권역 결과 초기화</h3>
          <p className="mb-3 text-sm text-gray-500">모든 권역의 대진·경기 결과를 삭제하고 진행 상태를 SETUP으로 되돌립니다.</p>
          <button
            type="button"
            onClick={() => runAction("reset_zone_results")}
            disabled={!!loading || !hasZoneMatches}
            className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading === "reset_zone_results" ? "처리 중…" : "권역 결과 초기화"}
          </button>
        </div>
        <div className="rounded border border-site-border p-4">
          <h3 className="mb-2 font-medium">진출자 취합 초기화</h3>
          <p className="mb-3 text-sm text-gray-500">저장된 본선 진출자 목록을 삭제합니다. 본선 대진이 있으면 먼저 본선 초기화를 하세요.</p>
          <button
            type="button"
            onClick={() => runAction("reset_qualifiers")}
            disabled={!!loading || !hasQualifiers}
            className="rounded bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading === "reset_qualifiers" ? "처리 중…" : "진출자 취합 초기화"}
          </button>
        </div>
        <div className="rounded border border-site-border p-4">
          <h3 className="mb-2 font-medium">본선 대진 초기화</h3>
          <p className="mb-3 text-sm text-gray-500">본선 경기 대진을 모두 삭제하고 진행 상태를 FINAL_READY로 되돌립니다.</p>
          <button
            type="button"
            onClick={() => runAction("reset_final_bracket")}
            disabled={!!loading || !hasFinalMatches}
            className="rounded bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading === "reset_final_bracket" ? "처리 중…" : "본선 대진 초기화"}
          </button>
        </div>
        <div className="rounded border border-site-border p-4">
          <h3 className="mb-2 font-medium">진행 상태 강제 변경</h3>
          <p className="mb-3 text-sm text-gray-500">대회 진행 상태를 선택한 값으로 변경합니다.</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={stageSelect}
              onChange={(e) => setStageSelect(e.target.value)}
              className="rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm"
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s] ?? s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => runAction("set_stage", { action: "set_stage", tournamentStage: stageSelect })}
              disabled={!!loading}
              className="rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading === "set_stage" ? "처리 중…" : "상태 변경"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
