"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import NotificationBar from "./_components/NotificationBar";
import Button from "./_components/Button";

type Org = { id: string; name: string; slug: string };

export function TournamentNewForm({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organizationId: organizations[0]?.id ?? "",
    name: "",
    date: "",
    time: "09:00",
    venue: "",
    status: "OPEN",
    gameFormat: "",
  });
  const statusOptions = TOURNAMENT_STATUSES as readonly { value: string; label: string }[];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.organizationId) {
      setError("업체를 선택해주세요. 업체가 없으면 먼저 생성해주세요.");
      return;
    }
    if (!form.name.trim()) {
      setError("대회명을 입력해주세요.");
      return;
    }
    if (!form.date) {
      setError("날짜를 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const startAt = new Date(`${form.date}T${form.time}`);
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: form.organizationId,
          name: form.name.trim(),
          startAt: startAt.toISOString(),
          venue: form.venue.trim() || undefined,
          status: form.status,
          gameFormat: form.gameFormat.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      router.push("/admin/tournaments");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <NotificationBar color="danger">{error}</NotificationBar>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            업체
          </label>
          <select
            required
            value={form.organizationId}
            onChange={(e) =>
              setForm((f) => ({ ...f, organizationId: e.target.value }))
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">선택</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.slug})
              </option>
            ))}
          </select>
          {organizations.length === 0 && (
            <p className="text-xs text-site-primary mt-1">
              업체가 없습니다. 설정에서 업체를 먼저 만드세요.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            대회명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시간
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            장소
          </label>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="예: OO당구장"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value }))
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            경기방식
          </label>
          <input
            type="text"
            value={form.gameFormat}
            onChange={(e) =>
              setForm((f) => ({ ...f, gameFormat: e.target.value }))
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="예: 3판 2선승, 싱글 엘리미네이션"
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="submit"
            label={loading ? "저장중" : "저장"}
            color="info"
            disabled={loading}
          />
          <Button href="/admin/tournaments" label="취소" color="contrast" outline />
        </div>
      </form>
    </div>
  );
}
