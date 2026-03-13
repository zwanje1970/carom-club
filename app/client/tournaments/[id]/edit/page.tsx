"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import { RichEditor } from "@/components/RichEditor";

export default function ClientTournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    startAt: "",
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${id}`);
        if (!res.ok) {
          setError("대회 정보를 불러올 수 없습니다.");
          setLoading(false);
          return;
        }
        const t = await res.json();
        const startAt = t.startAt ? new Date(t.startAt) : null;
        setForm({
          name: t.name ?? "",
          startAt: startAt ? `${startAt.toISOString().slice(0, 16)}` : "",
          venue: t.venue ?? "",
          status: t.status ?? "OPEN",
          entryFee: t.entryFee != null ? t.entryFee : "",
          maxParticipants: t.maxParticipants != null ? t.maxParticipants : "",
          entryCondition: t.entryCondition ?? "",
          gameFormat: t.gameFormat ?? "",
          prizeInfo: t.prizeInfo ?? "",
          rules: t.rules ?? "",
          promoContent: t.promoContent ?? "",
        });
      } catch {
        setError("대회 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!form.name.trim()) {
      setError("대회명을 입력해 주세요.");
      return;
    }
    if (!form.startAt) {
      setError("일시를 선택해 주세요.");
      return;
    }
    if (!form.venue.trim()) {
      setError("장소를 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startAt: new Date(form.startAt).toISOString(),
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
        router.push(`/client/tournaments/${id}`);
        router.refresh();
      }, 800);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-500">불러오는 중...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-site-text">대회 기본 정보 수정</h1>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">일시 *</label>
            <input
              type="datetime-local"
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            />
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
              value={form.prizeInfo}
              onChange={(e) => setForm((f) => ({ ...f, prizeInfo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경기 요강</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 min-h-[120px]"
              value={form.rules}
              onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
            />
          </div>
        </section>

        <section className="rounded-lg border border-site-border bg-site-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">대회 홍보</h2>
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
            disabled={saving}
            className="rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장중" : "저장"}
          </button>
          <Link
            href={`/client/tournaments/${id}`}
            className="rounded-lg border border-site-border px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
