"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKoreanDate } from "@/lib/format-date";

export type NoteFilter = "all" | "public" | "private" | "sent";

interface NoteItem {
  id: string;
  title: string | null;
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  createdAt: string;
  sentToTroubleCount?: number;
}

export interface BilliardNotesListClientProps {
  basePath?: string;
}

const FILTERS: { value: NoteFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "public", label: "공개" },
  { value: "private", label: "비공개" },
  { value: "sent", label: "난구해결 전송" },
];

export function BilliardNotesListClient({ basePath = "/mypage/notes" }: BilliardNotesListClientProps) {
  const [list, setList] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");

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

  const filtered =
    filter === "all"
      ? list
      : filter === "public"
        ? list.filter((n) => n.visibility === "community")
        : filter === "private"
          ? list.filter((n) => n.visibility !== "community")
          : list.filter((n) => (n.sentToTroubleCount ?? 0) > 0);

  if (loading) {
    return <p className="text-gray-500 py-6">불러오는 중…</p>;
  }
  if (error) {
    return (
      <p className="text-red-600 py-4">
        {error}
        {error.includes("로그인") && (
          <Link href="/login" className="ml-2 underline">로그인</Link>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f.value
                ? "bg-site-primary text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">
          {filter === "all" ? "저장한 노트가 없습니다. " : "해당하는 노트가 없습니다. "}
          {filter === "all" && (
            <Link href={`${basePath}/new`} className="text-site-primary hover:underline">새 노트 작성</Link>
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <li key={n.id}>
              <Link
                href={`${basePath}/${n.id}`}
                className="flex gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700">
                  {n.imageUrl ? (
                    <img src={n.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">이미지 없음</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-site-text line-clamp-1">
                    {n.title?.trim() || n.memo?.trim() || "(제목 없음)"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatKoreanDate(n.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {n.visibility === "community" ? "공개" : "비공개"}
                    {(n.sentToTroubleCount ?? 0) > 0 && ` · 난구해결 전송 ${n.sentToTroubleCount}회`}
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
