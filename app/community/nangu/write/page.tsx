"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BilliardTableCanvas } from "@/components/billiard";
import { BilliardTableEditor, type BilliardTableEditorHandle } from "@/components/billiard";
import type { NanguBallPlacement } from "@/lib/nangu-types";

type PlacementSource = 
  | { type: "fromNote"; placement: NanguBallPlacement }
  | { type: "direct"; placement: null };

export default function NanguWritePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromNoteId = searchParams.get("fromNote");
  const [source, setSource] = useState<PlacementSource | null>(null);
  const [loading, setLoading] = useState(!!fromNoteId);
  const [step, setStep] = useState<1 | 2>(1);
  const [placement, setPlacement] = useState<NanguBallPlacement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<BilliardTableEditorHandle | null>(null);

  useEffect(() => {
    if (!fromNoteId) {
      setSource({ type: "direct", placement: null });
      setLoading(false);
      return;
    }
    fetch(`/api/community/billiard-notes/${fromNoteId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("노트를 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        const placement: NanguBallPlacement = {
          redBall: data.redBall,
          yellowBall: data.yellowBall,
          whiteBall: data.whiteBall,
          cueBall: data.cueBall === "yellow" ? "yellow" : "white",
        };
        setSource({ type: "fromNote", placement });
        setPlacement(placement);
      })
      .catch(() => setSource({ type: "fromNote", placement: null }))
      .finally(() => setLoading(false));
  }, [fromNoteId]);

  const handleConfirmFromNote = () => {
    if (source?.type === "fromNote" && source.placement) setStep(2);
  };

  const handleDirectNext = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const snap = editor.getSnapshot();
    const placement: NanguBallPlacement = {
      redBall: snap.redBall,
      yellowBall: snap.yellowBall,
      whiteBall: snap.whiteBall,
      cueBall: snap.cueBall,
    };
    setPlacement(placement);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placement) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/community/nangu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          ballPlacement: placement,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "저장에 실패했습니다.");
      }
      const { id } = await res.json();
      router.push(`/community/nangu/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-gray-500">노트 불러오는 중…</p>
        </div>
      </main>
    );
  }

  if (fromNoteId && source?.type === "fromNote" && !source.placement) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-red-600">노트를 불러올 수 없습니다.</p>
          <Link href="/community/nangu" className="mt-2 inline-block text-site-primary underline">목록으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <Link href="/community/nangu" className="hover:text-site-primary">난구해결사</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">글쓰기</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">난구해결사 글쓰기</h1>

        {step === 1 && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {source?.type === "fromNote"
                ? "당구노트에서 가져온 공 배치입니다. 이 배치로 문제를 등록합니다. 게시 후에는 공 배치를 수정할 수 없습니다."
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
                  onClick={handleConfirmFromNote}
                  className="mt-4 w-full py-3 rounded-lg bg-site-primary text-white font-medium"
                >
                  이 배치로 글쓰기
                </button>
              </div>
            )}
            {source?.type === "direct" && (
              <div className="mb-6">
                <NanguBallPlacementEditor ref={editorRef} onNext={handleDirectNext} />
              </div>
            )}
          </>
        )}

        {step === 2 && placement && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nangu-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목</label>
              <input
                id="nangu-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text px-3 py-2"
                placeholder="문제구 상황이나 질문을 적어주세요."
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
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
          </form>
        )}
      </div>
    </main>
  );
}

const NanguBallPlacementEditor = React.forwardRef<
  BilliardTableEditorHandle,
  { onNext: () => void }
>(function NanguBallPlacementEditor({ onNext }, ref) {
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
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">공을 드래그해 배치한 뒤 아래 버튼을 누르세요.</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full py-3 rounded-lg bg-site-primary text-white font-medium"
      >
        다음: 제목·설명 입력
      </button>
    </div>
  );
});
