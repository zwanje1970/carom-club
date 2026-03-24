"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatKoreanDate } from "@/lib/format-date";
import { clearBilliardNoteNewPageGuardOnly } from "@/lib/billiard-note-composer-session";

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
  const pathname = usePathname() ?? basePath;
  const [list, setList] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** 서버/앱 오류 메시지(401 제외) */
  const [error, setError] = useState("");
  /** 네트워크 단절·fetch 실패 등(401과 구분) */
  const [networkError, setNetworkError] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [filter, setFilter] = useState<NoteFilter>("all");

  useEffect(() => {
    clearBilliardNoteNewPageGuardOnly();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setNetworkError(false);
    setNeedLogin(false);
    fetch("/api/community/billiard-notes?mine=1", {
      credentials: "include",
      mode: "same-origin",
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setNeedLogin(true);
          setList([]);
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "목록을 불러올 수 없습니다.");
        }
        return res.json() as Promise<NoteItem[]>;
      })
      .then((data) => {
        if (!cancelled && data) setList(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const isLikelyNetwork =
          e instanceof TypeError ||
          (e instanceof Error && (e.name === "AbortError" || /network|fetch|load failed/i.test(e.message)));
        if (isLikelyNetwork) {
          setNetworkError(true);
          setError("");
          return;
        }
        setError(e instanceof Error ? e.message : "오류");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
  if (needLogin) {
    const next = `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-site-text">
        <p className="font-medium">로그인이 필요합니다.</p>
        <p className="mt-1 text-gray-600 dark:text-slate-400">
          세션이 없거나 만료되었습니다. 다시 로그인하면 난구노트 목록을 불러올 수 있습니다.
        </p>
        <Link
          href={next}
          className="mt-3 inline-block rounded-lg bg-site-primary px-4 py-2 text-white font-medium hover:opacity-90"
        >
          로그인하기
        </Link>
      </div>
    );
  }
  if (networkError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/20 p-4 text-sm text-site-text">
        <p className="font-medium text-red-800 dark:text-red-200">네트워크 오류</p>
        <p className="mt-1 text-gray-600 dark:text-slate-400">
          연결을 확인한 뒤 다시 시도해 주세요. (인증 문제가 아닐 수 있습니다)
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-red-600 py-4">
        {error}
        {(error.includes("로그인") || error.includes("401")) && (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="ml-2 underline">
            로그인
          </Link>
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
          {filter === "all" ? "저장한 난구노트가 없습니다. " : "해당하는 난구노트가 없습니다. "}
          {filter === "all" && (
            <Link href={`${basePath}/new`} className="text-site-primary hover:underline">새 난구노트 작성</Link>
          )}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="난구노트 목록">
          {filtered.map((n) => (
            <li key={n.id}>
              <Link
                href={`${basePath}/${n.id}`}
                className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-slate-700">
                  {n.imageUrl ? (
                    <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">없음</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-site-text line-clamp-2 leading-snug">
                    {n.title?.trim() || n.memo?.trim() || "(제목 없음)"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatKoreanDate(n.createdAt)} · {n.visibility === "community" ? "공개" : "비공개"}
                    {(n.sentToTroubleCount ?? 0) > 0 && ` · 난구 ${n.sentToTroubleCount}회`}
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
