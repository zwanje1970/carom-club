"use client";

import React, { useState, useEffect } from "react";
import type { CueBallType } from "@/lib/billiard-table-constants";
import { BILLIARD_NOTE_DRAFT_KEY } from "@/lib/billiard-note-composer-session";

/** 배치 전 표시용 기본 당구대 이미지. 배치 화면과 동일한 테이블(공 없음)을 줄인 SVG. */
const DEFAULT_TABLE_IMAGE = "/images/billiard-table-preview.svg";

export interface PlacementPayload {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  /** 미선택 시 공배치 전체화면에서 흰공/노란공 수구 선택 UI 표시 */
  cueBall?: CueBallType;
  getImageDataURL: () => string;
}

export interface BilliardNoteFormScreenProps {
  /** 미리보기 이미지 URL (dataURL 또는 업로드 URL). 없으면 기본 테이블 표시 */
  previewImageUrl: string | null;
  /** 폼 제출: title, noteDate, content 전달. 배치/이미지는 부모 state 사용 */
  onSubmit: (data: { title: string; noteDate: string; content: string }) => Promise<string | null>;
  /** 배치 편집 열기 (클릭 시) */
  onOpenPlacement: () => void;
  /** 배치 편집 중 여부 */
  showPlacement: boolean;
  /** 배치 데이터 있음 여부 (저장 버튼 활성화 등) */
  hasPlacement: boolean;
  /** 저장 후 이동할 난구노트 상세 경로 기준. 예: /mypage/notes */
  redirectBasePath?: string;
}

export function BilliardNoteFormScreen({
  previewImageUrl,
  onSubmit,
  onOpenPlacement,
  showPlacement,
  hasPlacement,
  redirectBasePath = "/mypage/notes",
}: BilliardNoteFormScreenProps) {
  const [title, setTitle] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNoteDate((prev) => (prev ? prev : new Date().toISOString().slice(0, 10)));
  }, []);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(BILLIARD_NOTE_DRAFT_KEY) : null;
      if (raw) {
        const d = JSON.parse(raw) as { title?: string; content?: string };
        if (d.title != null) setTitle(String(d.title));
        if (d.content != null) setContent(String(d.content));
        setSaving(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPlacement) {
      setError("당구대 배치를 먼저 해 주세요.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const id = await onSubmit({ title, noteDate, content });
      if (id) window.location.href = `${redirectBasePath}/${id}`;
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error(e);
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 3구 연습 1번대"
          className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          날짜
        </label>
        <input
          type="date"
          value={noteDate}
          onChange={(e) => setNoteDate(e.target.value)}
          className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          내용
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="상황, 느낀 점, 다음에 연습할 점 등"
          rows={4}
          className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          당구공배치
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          클릭하여 당구공 배치 화면으로 이동
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(
                BILLIARD_NOTE_DRAFT_KEY,
                JSON.stringify({ title, content })
              );
            } catch {
              // ignore
            }
            onOpenPlacement();
          }}
          className="block w-full focus:outline-none focus:ring-2 focus:ring-site-primary/50 rounded overflow-hidden"
        >
          <img
            src={previewImageUrl ?? DEFAULT_TABLE_IMAGE}
            alt={previewImageUrl ? "저장된 당구대 배치" : "기본 당구대"}
            className="w-full max-h-[280px] object-contain block"
          />
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving || !title.trim() || !content.trim()}
        className="w-full py-2.5 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
