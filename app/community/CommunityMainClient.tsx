"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCommunityListDate } from "@/lib/format-date";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";

type PostItem = {
  id: string;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  boardSlug: string;
  boardName: string;
};

export function CommunityMainClient({
  latest,
  initialCategory,
  canManageReports = false,
  showSolverEntry,
}: {
  latest: PostItem[];
  initialCategory: "all" | "free" | "qna" | "trouble" | "notice";
  canManageReports?: boolean;
  showSolverEntry: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postLink = (p: PostItem) =>
    p.boardSlug === "trouble" ? `/community/trouble/${p.id}` : `/community/${p.boardSlug}/${p.id}`;

  const fabHref = showSolverEntry ? "/community/trouble/write" : "/community/free/write";
  const categoryRaw = searchParams?.get("category") ?? initialCategory;
  const category =
    categoryRaw === "all" ||
    categoryRaw === "free" ||
    categoryRaw === "qna" ||
    categoryRaw === "trouble" ||
    categoryRaw === "notice"
      ? categoryRaw
      : "all";

  const categoryTabs = [
    { value: "all", label: "전체" },
    { value: "free", label: "자유게시판" },
    { value: "qna", label: "질문게시판" },
    { value: "trouble", label: "난구해결사" },
    { value: "notice", label: "공지사항" },
  ] as const;

  const updateCategory = (
    next: "all" | "free" | "qna" | "trouble" | "notice"
  ) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") params.delete("category");
    else params.set("category", next);
    const qs = params.toString();
    router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
  };

  const badge = (p: PostItem): "N" | "HOT" | null => {
    if (p.commentCount > 0) return "N";
    if (p.viewCount >= 100) return "HOT";
    return null;
  };

  const categoryTag = (slug: string): string => {
    if (slug === "free") return "자유";
    if (slug === "qna") return "질문";
    if (slug === "trouble") return "난구";
    if (slug === "notice") return "공지";
    return slug;
  };

  const filtered =
    category === "all" ? latest : latest.filter((p) => p.boardSlug === category);

  return (
    <div className="mt-4 pb-20">
      {canManageReports && (
        <div className="mb-3 flex justify-end">
          <Link href="/community/admin/reports" className="text-sm text-site-primary hover:underline">
            신고 관리
          </Link>
        </div>
      )}

      {/*
        오픈 전 심플 모드:
        - 게시판 통합 최신순만 노출
        - 오늘/주간/추천(인기) UI는 숨김 처리
      */}
      <div
        className="sticky top-14 z-10 border-b border-gray-100 bg-white shadow-sm dark:border-slate-100/80 dark:bg-slate-950 md:top-16"
      >
        <div className="py-4">
          <div
            role="tablist"
            aria-label="게시판 카테고리"
            className="flex flex-nowrap gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {categoryTabs.map((tab) => {
              const active = category === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateCategory(tab.value)}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-sm transition-colors ${
                    active
                      ? "bg-site-primary/12 font-semibold text-site-text dark:bg-site-primary/20"
                      : "font-medium text-gray-500 hover:bg-gray-100 hover:text-site-text dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ul
        className="divide-y divide-gray-200 pt-4 dark:divide-slate-700"
        aria-label="게시글 목록"
      >
        {filtered.length === 0 && (
          <li className="py-4 px-1 text-sm text-gray-500">글이 없습니다.</li>
        )}
        {filtered.map((p) => (
          <li key={p.id}>
            <Link href={postLink(p)} className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-site-text line-clamp-2 leading-snug">
                  <span className="mr-1 inline-flex align-middle rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-slate-600 dark:text-slate-300">
                    {categoryTag(p.boardSlug)}
                  </span>
                  <span className="truncate">{p.title}</span>
                  {badge(p) === "N" ? (
                    <span className="ml-1 inline-flex align-middle text-[11px] font-semibold text-site-primary">N</span>
                  ) : badge(p) === "HOT" ? (
                    <span className="ml-1 inline-flex align-middle text-[11px] font-semibold text-rose-600">HOT</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {p.boardName} · {p.authorName} · {formatCommunityListDate(p.createdAt)} · 조회 {p.viewCount}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                {p.commentCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <CommunityWriteFab href={fabHref} />
    </div>
  );
}
