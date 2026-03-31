"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { NanguSolverIcon } from "@/components/community/NanguSolverIcon";
import {
  NanguWritePlacementStep,
  NanguWriteSubmitStep,
  type PlacementSource,
} from "@/components/nangu/NanguWriteFlowSections";
import type { BilliardTableEditorHandle } from "@/components/billiard";
import { normalizeCueBallType } from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";

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
        if (!res.ok) throw new Error("난구노트를 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        const placement: NanguBallPlacement = {
          redBall: data.redBall,
          yellowBall: data.yellowBall,
          whiteBall: data.whiteBall,
          cueBall: normalizeCueBallType(data.cueBall),
        };
        setSource({ type: "fromNote", placement });
        setPlacement(placement);
      })
      .catch(() => setSource({ type: "direct", placement: null }))
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
          <p className="text-red-600">난구노트를 불러올 수 없습니다.</p>
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
        <div className="flex items-center gap-0 mb-6">
          <NanguSolverIcon size={56} />
          <h1 className="text-xl font-bold">난구해결사 글쓰기</h1>
        </div>

        {step === 1 && (
          <NanguWritePlacementStep
            source={source}
            placement={placement}
            editorRef={editorRef}
            onConfirmFromNote={handleConfirmFromNote}
            onDirectNext={handleDirectNext}
          />
        )}

        {step === 2 && placement && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <NanguWriteSubmitStep
              title={title}
              content={content}
              submitting={submitting}
              error={error}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onBack={() => setStep(1)}
            />
          </form>
        )}
      </div>
    </main>
  );
}
