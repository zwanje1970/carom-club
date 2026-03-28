"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NoteSolverLinkagePanel } from "@/components/note/NoteSolverLinkagePanel";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format-date";

interface NoteData {
  id: string;
  authorName: string;
  title: string | null;
  noteDate: Date | null;
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: "white" | "yellow";
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  /** 생성 시각 — RSC에서 Date 전달, 표시는 {@link formatKoreanDateTime}(초 생략) */
  createdAt: Date;
  isAuthor: boolean;
}

export interface BilliardNoteDetailClientProps {
  note: NoteData;
  /** 이 노트에서 생성·연결된 난구해결사(NanguPost) 게시글 id */
  linkedNanguPostId?: string | null;
  /** 구 trouble 게시판 글 id — nangu 연결이 없을 때만 전달 */
  linkedTroublePostId?: string | null;
  basePath?: string;
}

export function BilliardNoteDetailClient({
  note,
  linkedNanguPostId = null,
  linkedTroublePostId = null,
  basePath = "/mypage/notes",
}: BilliardNoteDetailClientProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const previewOrientation = useTableOrientation();

  const ballPlacement: NanguBallPlacement = useMemo(
    () => ({
      redBall: note.redBall,
      yellowBall: note.yellowBall,
      whiteBall: note.whiteBall,
      cueBall: note.cueBall,
    }),
    [note]
  );

  const cuePos = note.cueBall === "yellow" ? note.yellowBall : note.whiteBall;

  const handleDelete = async () => {
    if (!note.isAuthor) return;
    if (!confirm("이 난구노트를 삭제할까요?")) return;
    setError("");
    const res = await fetch(`/api/community/billiard-notes/${note.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.push(basePath);
  };

  const tableViewer = (
    <div
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
      style={{
        maxWidth: DEFAULT_TABLE_WIDTH,
        aspectRatio:
          previewOrientation === "portrait"
            ? `${DEFAULT_TABLE_HEIGHT} / ${DEFAULT_TABLE_WIDTH}`
            : `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
      }}
    >
      <NanguReadOnlyLayout
        ballPlacement={ballPlacement}
        fillContainer
        embedFill
        className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
        showGrid
        drawStyle="realistic"
        showCueBallSpot
        orientation={previewOrientation}
      />
    </div>
  );

  const actionBar = note.isAuthor && (
    <>
      <Link
        href={`${basePath}/${note.id}/edit`}
        className="flex-1 min-w-0 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 font-medium text-sm text-center hover:bg-gray-50 dark:hover:bg-slate-800"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="flex-1 min-w-0 py-2.5 rounded-lg border border-red-300 text-red-600 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        삭제
      </button>
    </>
  );

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <div className="rounded-lg flex justify-center">
        {note.isAuthor ? (
          <Link
            href={`${basePath}/${note.id}/edit`}
            className="flex w-full justify-center focus:outline-none focus:ring-2 focus:ring-site-primary/50 rounded-lg"
            aria-label="당구공 배치 화면으로 이동"
          >
            {tableViewer}
          </Link>
        ) : (
          tableViewer
        )}
      </div>

      <NoteSolverLinkagePanel
        noteId={note.id}
        noteImageUrl={note.imageUrl}
        isAuthor={note.isAuthor}
        linkedNanguPostId={linkedNanguPostId}
        linkedTroublePostId={linkedTroublePostId}
        ballPlacement={ballPlacement}
        cuePos={cuePos}
        onError={setError}
      />

      {note.noteDate && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          기록 날짜: {formatKoreanDate(note.noteDate)}
        </p>
      )}
      {note.memo && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">내용</h2>
          <p className="text-site-text whitespace-pre-wrap">{note.memo}</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        {note.authorName} · {formatKoreanDateTime(note.createdAt)}
        {" · "}
        {note.visibility === "community" ? "커뮤니티 게시" : "비공개"}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {note.isAuthor && (
        <div className="hidden md:flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-slate-600">
          <div className="flex flex-wrap gap-2">{actionBar}</div>
        </div>
      )}

      {note.isAuthor && (
        <div className="fixed bottom-20 left-0 right-0 z-30 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-gray-200 dark:border-slate-700 md:hidden">
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            <div className="flex gap-2 flex-wrap">{actionBar}</div>
          </div>
        </div>
      )}
    </div>
  );
}
