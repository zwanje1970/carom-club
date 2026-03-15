"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PushSubscribeButton } from "@/components/push/PushSubscribeButton";

export function TournamentApplyForm({
  tournamentId,
  entryFee,
  accountNumber,
  entryConditionsHtml,
  additionalSlot = false,
}: {
  tournamentId: string;
  entryFee: number | null;
  /** 계좌번호(은행명, 예금주) — 참가신청 시 입금용으로 복사 버튼과 함께 표시 */
  accountNumber: string | null;
  entryConditionsHtml: string | null;
  additionalSlot?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [clubOrAffiliation, setClubOrAffiliation] = useState("");
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
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
        body: JSON.stringify({
          tournamentId,
          depositorName: depositorName.trim(),
          clubOrAffiliation: clubOrAffiliation.trim() || undefined,
          ...(additionalSlot && { additionalSlot: true }),
        }),
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
      setSuccessMessage(data.message || "참가 신청이 접수되었습니다. 운영자 승인 후 참가가 확정됩니다.");
      setDepositorName("");
      setClubOrAffiliation("");
      setAgreed(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMessage && (
        <div className="space-y-2">
          <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300 p-3 rounded border border-green-200 dark:border-green-800">
            {successMessage}
          </p>
          <PushSubscribeButton
            className="inline-flex items-center rounded-lg border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-site-text hover:bg-site-bg"
            label="대진표 알림 받기"
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 p-2 rounded">{error}</p>
      )}
      <p className="text-sm text-gray-600">
        {additionalSlot ? "추가 슬롯 참가비 (2배): " : "참가비: "}
        {entryFee != null ? `${Number(entryFee).toLocaleString()}원` : "문의"}
      </p>
      {accountNumber && accountNumber.trim() && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">계좌번호(은행명, 예금주)</label>
          <div className="flex gap-2">
            <span className="flex-1 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm break-all">
              {accountNumber.trim()}
            </span>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(accountNumber.trim());
              }}
              className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              복사
            </button>
          </div>
        </div>
      )}
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
          className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="입금 시 사용할 이름"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">소속/클럽 (선택)</label>
        <input
          type="text"
          value={clubOrAffiliation}
          onChange={(e) => setClubOrAffiliation(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="소속 동호회·클럽명"
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
        {loading ? "처리 중..." : additionalSlot ? "추가 슬롯 신청" : "참가 신청"}
      </button>
      {!additionalSlot && (
        <p className="text-sm text-gray-500">
          <Link href="/login" className="text-site-primary hover:underline">로그인</Link> 후 신청할 수 있습니다.
        </p>
      )}
    </form>
  );
}
