"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NoteData {
  id: string;
  authorName: string;
  title: string | null;
  noteDate: string | null;
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: "white" | "yellow";
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  createdAt: string;
  isAuthor: boolean;
}

export interface BilliardNoteDetailClientProps {
  note: NoteData;
  /** 노트 목록/수정 링크 기준 경로. 예: /mypage/notes */
  basePath?: string;
}

export function BilliardNoteDetailClient({ note, basePath = "/mypage/notes" }: BilliardNoteDetailClientProps) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(note.visibility);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const toggleCommunity = async () => {
    if (!note.isAuthor) return;
    setError("");
    setUpdating(true);
    const next = visibility === "community" ? "private" : "community";
    try {
      const res = await fetch(`/api/community/billiard-notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "변경에 실패했습니다.");
      }
      setVisibility(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!note.isAuthor) return;
    if (!confirm("이 노트를 삭제할까요?")) return;
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

  const tableImage = note.imageUrl ? (
    <img
      src={note.imageUrl}
      alt="저장된 당구대 배치"
      className="max-w-full h-auto block w-full"
    />
  ) : (
    <div className="w-full aspect-[2/1] flex items-center justify-center text-gray-500 bg-gray-100 dark:bg-slate-800">
      이미지 없음
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg overflow-hidden bg-gray-900 flex justify-center">
        {note.isAuthor ? (
          <Link
            href={`${basePath}/${note.id}/edit`}
            className="flex justify-center focus:outline-none focus:ring-2 focus:ring-site-primary/50 rounded-lg"
            aria-label="당구공 배치 화면으로 이동"
          >
            {tableImage}
          </Link>
        ) : (
          tableImage
        )}
      </div>

      {note.noteDate && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          기록 날짜: {new Date(note.noteDate).toLocaleDateString("ko-KR")}
        </p>
      )}
      {note.memo && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            내용
          </h2>
          <p className="text-site-text whitespace-pre-wrap">{note.memo}</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        {note.authorName} · {new Date(note.createdAt).toLocaleString("ko-KR")}
        {" · "}
        {visibility === "community" ? "커뮤니티 게시" : "비공개"}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {note.isAuthor && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-slate-600">
          <Link
            href={`/community/nangu/write?fromNote=${note.id}`}
            className="px-4 py-2 rounded-lg bg-site-primary text-white font-medium text-sm"
          >
            난구해결로 보내기
          </Link>
          <Link
            href={`${basePath}/${note.id}/edit`}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 font-medium text-sm"
          >
            수정
          </Link>
          <button
            type="button"
            onClick={toggleCommunity}
            disabled={updating}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 font-medium text-sm disabled:opacity-50"
          >
            {visibility === "community" ? "게시 취소" : "커뮤니티에 게시"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 font-medium text-sm"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
