"use client";

import React, { useRef, useState } from "react";
import {
  BilliardTableEditor,
  type BilliardTableEditorHandle,
} from "@/components/billiard";
import type { CueBallType } from "@/lib/billiard-table-constants";

export interface BilliardNoteEditorProps {
  initialRed?: { x: number; y: number };
  initialYellow?: { x: number; y: number };
  initialWhite?: { x: number; y: number };
  initialCueBall?: CueBallType;
  initialMemo?: string;
  onSave: (payload: {
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
    cueBall: CueBallType;
    memo: string;
    getImageDataURL: () => string;
  }) => Promise<void>;
  saveLabel?: string;
}

export function BilliardNoteEditor({
  initialRed,
  initialYellow,
  initialWhite,
  initialCueBall = "white",
  initialMemo = "",
  onSave,
  saveLabel = "저장",
}: BilliardNoteEditorProps) {
  const editorRef = useRef<BilliardTableEditorHandle>(null);
  const [memo, setMemo] = useState(initialMemo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const getImageDataURL = () =>
        editorRef.current?.getDataURL(true) ?? "";
      const snapshot = editorRef.current?.getSnapshot();
      if (!snapshot) throw new Error("편집 데이터를 가져올 수 없습니다.");
      await onSave({
        ...snapshot,
        memo: memo.trim(),
        getImageDataURL,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BilliardTableEditor
      ref={editorRef}
      initialRed={initialRed}
      initialYellow={initialYellow}
      initialWhite={initialWhite}
      initialCueBall={initialCueBall}
      showGrid={true}
      interactive={true}
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          메모
        </label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 뒤돌리기 두께 실수, 다음에 연습 필요"
          rows={3}
          className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
      >
        {saving ? "저장 중…" : saveLabel}
      </button>
    </BilliardTableEditor>
  );
}
