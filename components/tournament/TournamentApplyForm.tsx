"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TournamentApplyForm({
  tournamentId,
  entryFee,
  entryConditionsHtml,
}: {
  tournamentId: string;
  entryFee: number | null;
  entryConditionsHtml: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!depositorName.trim()) {
      setError("입금자명을 입력해주세요.");
      return;
    }
    if (!agreed) {
      setError("참가요건에 동의해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tournaments/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, depositorName: depositorName.trim() }),
      });
      let data: { error?: string; message?: string } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text);
      } catch {
        // 응답이 비어 있거나 JSON이 아니면 빈 객체 사용
      }
      if (!res.ok) {
        setError(data.error || "신청에 실패했습니다.");
        return;
      }
      router.refresh();
      setDepositorName("");
      setAgreed(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      <p className="text-sm text-gray-600">
        참가비: {entryFee != null ? `${Number(entryFee).toLocaleString()}원` : "문의"}
      </p>
      {entryConditionsHtml && (
        <div className="border rounded p-3 bg-gray-50 max-h-40 overflow-auto">
          <div
            className="prose prose-sm max-w-none text-sm break-words overflow-hidden"
            dangerouslySetInnerHTML={{ __html: entryConditionsHtml }}
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          입금자명 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={depositorName}
          onChange={(e) => setDepositorName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="입금 시 사용할 이름"
        />
      </div>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 rounded border-gray-300"
        />
        <label htmlFor="agree" className="text-sm text-gray-700">
          위 참가요건을 확인하였으며, 동의합니다. <span className="text-red-500">*</span>
        </label>
      </div>
      <p className="text-xs text-gray-500">
        로그인한 회원 정보(이름, 연락처, 핸디 등)가 자동으로 반영됩니다. 로그인이 필요합니다.
      </p>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-site-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "처리 중..." : "참가 신청"}
      </button>
      <p className="text-sm text-gray-500">
        <Link href="/login" className="text-site-primary hover:underline">로그인</Link> 후 신청할 수 있습니다.
      </p>
    </form>
  );
}
