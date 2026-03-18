"use client";

import { useState } from "react";
import type { Popup } from "@/types/popup";
import { POPUP_PAGE_LABELS } from "@/lib/content/constants";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";

type Props = {
  initial?: Popup | null;
  onSubmit: (data: Omit<Popup, "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
};

export function PopupForm({ initial, onSubmit, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...initial,
        startAt: initial.startAt ? initial.startAt.slice(0, 16) : null,
        endAt: initial.endAt ? initial.endAt.slice(0, 16) : null,
      };
    }
    return {
      id: `pop-${Date.now()}`,
      title: "",
      description: null as string | null,
      imageUrl: null as string | null,
      buttonName: null as string | null,
      buttonLink: null as string | null,
      page: "home" as Popup["page"],
      startAt: null as string | null,
      endAt: null as string | null,
      hideForTodayEnabled: true,
      showCloseButton: true,
      isVisible: true,
      sortOrder: 0,
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("팝업 제목을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">팝업 제목 (필수)</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">팝업 설명</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
          rows={3}
          className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
        />
      </div>
      <div>
        <AdminImageField
          label="팝업 이미지 (첨부파일)"
          value={form.imageUrl ?? null}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          policy="content"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">버튼 이름</label>
          <input
            type="text"
            value={form.buttonName ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, buttonName: e.target.value || null }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">버튼 링크</label>
          <input
            type="text"
            value={form.buttonLink ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, buttonLink: e.target.value || null }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            placeholder="/tournaments"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">노출 페이지</label>
        <select
          value={form.page}
          onChange={(e) => setForm((f) => ({ ...f, page: e.target.value as Popup["page"] }))}
          className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
        >
          {(Object.entries(POPUP_PAGE_LABELS) as [keyof typeof POPUP_PAGE_LABELS, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">노출 시작일</label>
          <input
            type="datetime-local"
            value={form.startAt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value || null }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">노출 종료일</label>
          <input
            type="datetime-local"
            value={form.endAt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value || null }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.hideForTodayEnabled}
            onChange={(e) => setForm((f) => ({ ...f, hideForTodayEnabled: e.target.checked }))}
          />
          <span className="text-sm">오늘 하루 보지 않기</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.showCloseButton}
            onChange={(e) => setForm((f) => ({ ...f, showCloseButton: e.target.checked }))}
          />
          <span className="text-sm">닫기 버튼 표시</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
        <Button type="button" label="취소" color="contrast" outline onClick={onCancel} />
        {error && <NotificationBar color="danger">{error}</NotificationBar>}
      </div>
    </form>
  );
}
