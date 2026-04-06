"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCommunityListDate } from "@/lib/format-date";
import type { CommunityHubPostItem } from "@/types/page-slot-render-context";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";

/**
 * 커뮤니티 허브 게시글 탭·목록·FAB — `CommunityMainClient`와 동일 동작.
 * `postList` 슬롯에서도 재사용한다.
 */
export function CommunityPostListSection({
  latest,
  initialCategory,
  showSolverEntry,
}: {
  latest: CommunityHubPostItem[];
  initialCategory: "all" | "free" | "qna" | "notice";
  showSolverEntry: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postLink = (p: CommunityHubPostItem) =>
    p.boardSlug === "trouble" ? `/community/trouble/${p.id}` : `/community/${p.boardSlug}/${p.id}`;

  const fabHref = showSolverEntry ? "/community/nangu/write" : "/community/free/write";
  const categoryRaw = searchParams?.get("category") ?? initialCategory;
  const category =
    categoryRaw === "all" ||
    categoryRaw === "free" ||
    categoryRaw === "qna" ||
    categoryRaw === "notice"
      ? categoryRaw
      : "all";

  const categoryTabs = [
    { value: "all", label: "전체" },
    { value: "free", label: "자유게시판" },
    { value: "qna", label: "질문게시판" },
    { value: "notice", label: "공지사항" },
  ] as const;

  const updateCategory = (next: "all" | "free" | "qna" | "notice") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") params.delete("category");
    else params.set("category", next);
    const qs = params.toString();
    router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
  };

  const filtered = latest
    .filter((p) => p.boardSlug !== "trouble" && p.boardSlug !== "nangu")
    .filter((p) => (category === "all" ? true : p.boardSlug === category));

  return (
    <>
      <div className="sticky top-14 z-10 border-b border-gray-100 bg-white shadow-sm dark:border-slate-100/80 dark:bg-slate-950 md:top-16">
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

      <ul className="divide-y divide-gray-200 pt-4 dark:divide-slate-700" aria-label="게시글 목록">
        {filtered.length === 0 && (
          <li className="py-4 px-1 text-sm text-gray-500">글이 없습니다.</li>
        )}
        {filtered.map((p) => (
          <li key={p.id}>
            <Link
              href={postLink(p)}
              className="block py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
            >
              <div className="min-w-0">
                <p className="font-medium text-site-text line-clamp-2 leading-snug">
                  <span className="truncate">{p.title}</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {formatCommunityListDate(p.createdAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {showSolverEntry && <CommunityWriteFab href={fabHref} />}
    </>
  );
}
