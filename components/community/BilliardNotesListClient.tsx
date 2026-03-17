"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NoteItem {
  id: string;
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  createdAt: string;
}

export interface BilliardNotesListClientProps {
  /** 노트 목록/상세 링크 기준 경로. 예: /mypage/notes */
  basePath?: string;
}

export function BilliardNotesListClient({ basePath = "/mypage/notes" }: BilliardNotesListClientProps) {
  const [list, setList] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/community/billiard-notes?mine=1", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">불러오는 중…</p>;
  }
  if (error) {
    return (
      <p className="text-red-600">
        {error}
        {error.includes("로그인") && (
          <Link href="/login" className="ml-2 underline">
            로그인
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">
          저장한 노트가 없습니다.{" "}
          <Link href={`${basePath}/new`} className="text-site-primary hover:underline">작성</Link>해 보세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li key={n.id}>
              <Link
                href={`${basePath}/${n.id}`}
                className="flex gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <div className="w-24 h-24 shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-slate-700">
                  {n.imageUrl ? (
                    <img
                      src={n.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {n.memo || "(메모 없음)"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                    {" · "}
                    {n.visibility === "community" ? "커뮤니티 게시" : "비공개"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
