"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import { RichEditor } from "@/components/RichEditor";

export default function ClientTournamentsNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    date: "",
    time: "09:00",
    venue: "",
    status: "OPEN" as string,
    entryFee: "" as string | number,
    maxParticipants: "" as string | number,
    entryCondition: "",
    gameFormat: "",
    prizeInfo: "",
    rules: "",
    promoContent: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("대회명을 입력해 주세요.");
      return;
    }
    if (!form.date) {
      setError("날짜를 선택해 주세요.");
      return;
    }
    if (!form.time?.toString().trim()) {
      setError("시간을 입력해 주세요.");
      return;
    }
    if (!form.venue.trim()) {
      setError("장소를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const startAt = new Date(`${form.date}T${form.time}`);
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startAt: startAt.toISOString(),
          venue: form.venue.trim() || undefined,
          status: form.status,
          gameFormat: form.gameFormat.trim() || undefined,
          entryFee: form.entryFee === "" || form.entryFee === null ? null : Number(form.entryFee),
          maxParticipants: form.maxParticipants === "" || form.maxParticipants === null ? null : Number(form.maxParticipants),
          entryCondition: form.entryCondition.trim() || null,
          prizeInfo: form.prizeInfo.trim() || null,
          rules: form.rules.trim() || null,
          promoContent: form.promoContent.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(data.id ? `/client/tournaments/${data.id}` : "/client/tournaments");
        router.refresh();
      }, 800);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-site-text">대회 등록</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 p-2 rounded">저장되었습니다.</p>
        )}

        <section className="rounded-lg border border-site-border bg-site-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">기본 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대회명 *</label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
              <input
                type="date"
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시간 *</label>
              <input
                type="time"
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장소 *</label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {TOURNAMENT_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">참가 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">참가비 (원)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="예: 30000"
              value={form.entryFee === "" ? "" : form.entryFee}
              onChange={(e) => setForm((f) => ({ ...f, entryFee: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">참가 인원</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="예: 64"
              value={form.maxParticipants === "" ? "" : form.maxParticipants}
              onChange={(e) => setForm((f) => ({ ...f, maxParticipants: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">참가 조건</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="예: 평균 0.5 미만"
              value={form.entryCondition}
              onChange={(e) => setForm((f) => ({ ...f, entryCondition: e.target.value }))}
            />
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">경기 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경기 방식</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="예: 3구 64강 토너먼트"
              value={form.gameFormat}
              onChange={(e) => setForm((f) => ({ ...f, gameFormat: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상금</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="예: 1등 50만원, 2등 30만원"
              value={form.prizeInfo}
              onChange={(e) => setForm((f) => ({ ...f, prizeInfo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경기 요강</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 min-h-[120px]"
              placeholder="경기 요강을 입력해 주세요."
              value={form.rules}
              onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            />
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">대회 홍보</h2>
          <p className="text-xs text-gray-500">당구장 홍보 페이지와 동일한 편집기를 사용합니다. 이미지 업로드 가능.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대회 홍보 내용</label>
            <RichEditor
              value={form.promoContent}
              onChange={(v) => setForm((f) => ({ ...f, promoContent: v }))}
              placeholder="대회 홍보 내용을 작성하세요"
              minHeight="320px"
            />
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "저장중" : "등록"}
          </button>
          <Link
            href="/client/tournaments"
            className="rounded-lg border border-site-border px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
