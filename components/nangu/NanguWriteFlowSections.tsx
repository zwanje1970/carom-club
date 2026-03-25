"use client";

import React from "react";
import { BilliardTableCanvas } from "@/components/billiard";
import { BilliardTableEditor, type BilliardTableEditorHandle } from "@/components/billiard";
import type { NanguBallPlacement } from "@/lib/nangu-types";

export type PlacementSource =
  | { type: "fromNote"; placement: NanguBallPlacement }
  | { type: "direct"; placement: null };

export function NanguWritePlacementStep({
  source,
  placement,
  editorRef,
  onConfirmFromNote,
  onDirectNext,
}: {
  source: PlacementSource | null;
  placement: NanguBallPlacement | null;
  editorRef: React.Ref<BilliardTableEditorHandle>;
  onConfirmFromNote: () => void;
  onDirectNext: () => void;
}) {
  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {source?.type === "fromNote"
          ? "난구노트에서 가져온 공 배치입니다. 이 배치로 문제를 등록합니다. 게시 후에는 공 배치를 수정할 수 없습니다."
          : "문제가 되는 공 배치를 설정하세요. 게시 후에는 수정할 수 없습니다."}
      </p>
      {source?.type === "fromNote" && placement && (
        <div className="mb-6">
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50">
            <BilliardTableCanvas
              redBall={placement.redBall}
              yellowBall={placement.yellowBall}
              whiteBall={placement.whiteBall}
              cueBall={placement.cueBall}
              interactive={false}
              showGrid={true}
            />
          </div>
          <button
            type="button"
            onClick={onConfirmFromNote}
            className="mt-4 w-full py-3 rounded-lg bg-site-primary text-white font-medium"
          >
            이 배치로 글쓰기
          </button>
        </div>
      )}
      {source?.type === "direct" && (
        <div className="mb-6">
          <NanguBallPlacementEditor ref={editorRef} onNext={onDirectNext} placementMode />
        </div>
      )}
    </>
  );
}

export function NanguWriteSubmitStep({
  title,
  content,
  submitting,
  error,
  onTitleChange,
  onContentChange,
  onBack,
}: {
  title: string;
  content: string;
  submitting: boolean;
  error: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="nangu-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목</label>
        <input
          id="nangu-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text px-3 py-2"
          placeholder="문제 제목"
        />
      </div>
      <div>
        <label htmlFor="nangu-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">문제 설명</label>
        <textarea
          id="nangu-content"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text px-3 py-2"
          placeholder="문제구 상황이나 질문을 적어주세요."
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 font-medium"
        >
          이전
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="py-2 px-4 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
        >
          {submitting ? "등록 중…" : "등록"}
        </button>
      </div>
    </>
  );
}

const NanguBallPlacementEditor = React.forwardRef<
  BilliardTableEditorHandle,
  { onNext: () => void; placementMode?: boolean }
>(function NanguBallPlacementEditor({ onNext, placementMode = true }, ref) {
  const innerRef = React.useRef<BilliardTableEditorHandle>(null);
  React.useImperativeHandle(ref, () => innerRef.current!);
  return (
    <div>
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50">
        <BilliardTableEditor
          ref={innerRef}
          defaultMode="ball"
          interactive={true}
          showGrid={true}
          placementMode={placementMode}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">공을 드래그해 배치한 뒤 아래 버튼을 누르세요.</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full py-3 rounded-lg bg-site-primary text-white font-medium"
      >
        공배치 완료
      </button>
    </div>
  );
});
