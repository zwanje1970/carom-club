"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BracketGenerateButton({
  tournamentId,
  gameType,
  existingRoundsCount,
}: {
  tournamentId: string;
  gameType: string;
  existingRoundsCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/bracket/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: gameType,
          groupingMode: "random",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "대진표 생성에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const isCaromOrSurvival = gameType === "carom" || gameType === "jukbang" || gameType === "survival";

  return (
    <div className="mt-4 p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold text-gray-800 mb-2">대진표 생성</h3>
      {isCaromOrSurvival && (
        <p className="text-sm text-gray-600 mb-2">
          캐롬/서바이벌은 출석 체크된 참가자만 대상으로 생성됩니다.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {existingRoundsCount > 0 && (
        <p className="text-sm text-gray-500 mb-2">이미 라운드가 {existingRoundsCount}개 생성되어 있습니다. 다시 생성하면 추가됩니다.</p>
      )}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "생성 중..." : "대진표 생성"}
      </button>
    </div>
  );
}
