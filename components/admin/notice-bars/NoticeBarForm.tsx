"use client";

import { useState } from "react";
import type { NoticeBar } from "@/types/notice-bar";
import { NOTICE_BAR_PAGE_LABELS } from "@/lib/content/constants";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type Props = {
  initial?: NoticeBar | null;
  onSubmit: (data: Omit<NoticeBar, "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
};

export function NoticeBarForm({ initial, onSubmit, onCancel }: Props) {
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
      id: `nb-${Date.now()}`,
      message: "",
      linkType: "none" as NoticeBar["linkType"],
      internalPath: null as string | null,
      externalUrl: null as string | null,
      openInNewTab: false,
      backgroundColor: "#1e3a5f",
      textColor: "#ffffff",
      page: "all" as NoticeBar["page"],
      position: "below_header" as NoticeBar["position"],
      startAt: null as string | null,
      endAt: null as string | null,
      isVisible: true,
      sortOrder: 0,
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.message.trim()) {
      setError("공지 문구를 입력해 주세요.");
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
      {error && <NotificationBar color="danger">{error}</NotificationBar>}
      <div>
        <label className="block text-sm font-medium mb-1">공지 문구 (필수)</label>
        <input
          type="text"
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">링크 사용 여부</label>
        <select
          value={form.linkType}
          onChange={(e) => setForm((f) => ({ ...f, linkType: e.target.value as NoticeBar["linkType"] }))}
          className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
        >
          <option value="none">사용 안 함</option>
          <option value="internal">내부 링크</option>
          <option value="external">외부 링크</option>
        </select>
      </div>
      {form.linkType === "internal" && (
        <div>
          <label className="block text-sm font-medium mb-1">내부 경로</label>
          <input
            type="text"
            value={form.internalPath ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, internalPath: e.target.value || null }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            placeholder="/tournaments"
          />
        </div>
      )}
      {form.linkType === "external" && (
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">외부 URL</label>
            <input
              type="url"
              value={form.externalUrl ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value || null }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.openInNewTab}
              onChange={(e) => setForm((f) => ({ ...f, openInNewTab: e.target.checked }))}
            />
            <span className="text-sm">새 창에서 열기</span>
          </label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">배경 색상</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={form.backgroundColor}
              onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
              className="h-10 w-14 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={form.backgroundColor}
              onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
              className="flex-1 rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700 font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">텍스트 색상</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={form.textColor}
              onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
              className="h-10 w-14 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={form.textColor}
              onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
              className="flex-1 rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700 font-mono text-sm"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">노출 페이지</label>
          <select
            value={form.page}
            onChange={(e) => setForm((f) => ({ ...f, page: e.target.value as NoticeBar["page"] }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          >
            {(Object.entries(NOTICE_BAR_PAGE_LABELS) as [keyof typeof NOTICE_BAR_PAGE_LABELS, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">배너 위치</label>
          <select
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as NoticeBar["position"] }))}
            className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
          >
            <option value="below_header">헤더 바로 아래</option>
            <option value="fixed_top">사이트 상단 고정</option>
          </select>
        </div>
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
      <div className="flex gap-3">
        <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
        <Button type="button" label="취소" color="contrast" outline onClick={onCancel} />
      </div>
    </form>
  );
}
