"use client";

import Link from "next/link";
import { useRef, useState } from "react";

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

type Popular = {
  today: PostItem[];
  weekly: PostItem[];
  mostLiked: PostItem[];
  mostComments: PostItem[];
};

type LatestByBoard = Record<string, { id: string; title: string; authorName: string; likeCount: number; commentCount: number; createdAt: string }[]>;

const BOARD_SLUGS = ["free", "qna", "tips", "reviews", "trouble"] as const;
const BOARD_LABELS: Record<string, string> = { free: "자유", qna: "질문답변", tips: "공략/팁", reviews: "후기", trouble: "난구해결사" };

export function CommunityMainClient({
  boards,
  popular,
  latest,
  latestByBoard = { free: [], qna: [], tips: [], reviews: [] },
  troubleStats = { open: 0, solved: 0 },
  canManageReports = false,
}: {
  boards: { id: string; slug: string; name: string; type?: string }[];
  popular: Popular;
  latest: PostItem[];
  latestByBoard?: LatestByBoard;
  troubleStats?: { open: number; solved: number };
  canManageReports?: boolean;
}) {
  const hubBoards = boards.filter((b) => BOARD_SLUGS.includes(b.slug as (typeof BOARD_SLUGS)[number]));
  const [boardTab, setBoardTab] = useState(hubBoards[0]?.slug ?? "free");
  const [popularTab, setPopularTab] = useState<"today" | "weekly" | "liked" | "comments">("today");
  const [mobileBoardOpen, setMobileBoardOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const postLink = (p: PostItem) => (p.boardSlug === "trouble" ? `/community/trouble/${p.id}` : `/community/${p.boardSlug}/${p.id}`);

  const popularLabels = {
    today: "오늘 인기",
    weekly: "주간 인기",
    liked: "추천 많은 글",
    comments: "댓글 많은 글",
  };
  const popularData = popular[popularTab === "liked" ? "mostLiked" : popularTab === "comments" ? "mostComments" : popularTab === "weekly" ? "weekly" : "today"];

  const writeHref = `/community/${boardTab || "free"}/write`;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canManageReports && (
          <Link href="/community/admin/reports" className="text-sm text-site-primary hover:underline">
            신고 관리
          </Link>
        )}
        <div className="ml-auto">
          <Link href={writeHref} className="inline-flex items-center justify-center rounded-lg bg-site-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">
            글쓰기
          </Link>
        </div>
      </div>
      {/* 게시판 탭: PC 가로 탭, 모바일 드롭다운/스크롤 */}
      <section aria-label="게시판 선택">
        <div className="hidden sm:block border-b border-gray-200 dark:border-slate-600">
          <div className="flex gap-1 overflow-x-auto">
            {hubBoards.map((b) => (
              <Link
                key={b.id}
                href={`/community/${b.slug}`}
                className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                  boardTab === b.slug
                    ? "border-site-primary text-site-primary"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-site-text"
                }`}
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setMobileBoardOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-left"
          >
            <span>{hubBoards.find((b) => b.slug === boardTab)?.name ?? "게시판 선택"}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {mobileBoardOpen && (
            <div className="mt-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
              {hubBoards.map((b) => (
                <Link
                  key={b.id}
                  href={`/community/${b.slug}`}
                  onClick={() => setMobileBoardOpen(false)}
                  className="block px-4 py-3 text-sm border-b border-gray-100 dark:border-slate-700 last:border-0"
                >
                  {b.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="sm:hidden flex overflow-x-auto gap-2 py-2 -mx-4 px-4" ref={scrollRef}>
          {hubBoards.map((b) => (
            <Link
              key={b.id}
              href={`/community/${b.slug}`}
              className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium ${
                boardTab === b.slug ? "bg-site-primary text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {b.name}
            </Link>
          ))}
        </div>
      </section>

      {/* 인기글 */}
      <section aria-labelledby="popular-heading">
        <h2 id="popular-heading" className="text-lg font-semibold mb-3">인기글</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["today", "weekly", "liked", "comments"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPopularTab(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                popularTab === key ? "bg-site-primary text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {popularLabels[key]}
            </button>
          ))}
        </div>
        <ul className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-600">
          {popularData.length === 0 && <li className="px-4 py-6 text-gray-500 text-sm">글이 없습니다.</li>}
          {popularData.map((p) => (
            <li key={p.id}>
              <Link href={postLink(p)} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <span className="font-medium text-site-text line-clamp-1">{p.title}</span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  {p.boardName} · {p.authorName} · 추천 {p.likeCount} · 댓글 {p.commentCount} · 조회 {p.viewCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 최신글 */}
      <section aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="text-lg font-semibold mb-3">최신글</h2>
        <ul className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-600">
          {latest.length === 0 && <li className="px-4 py-6 text-gray-500 text-sm">글이 없습니다.</li>}
          {latest.map((p) => (
            <li key={p.id}>
              <Link href={postLink(p)} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <span className="font-medium text-site-text line-clamp-1">{p.title}</span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  [{p.boardName}] {p.authorName} · {new Date(p.createdAt).toLocaleString("ko-KR")} · 추천 {p.likeCount} · 댓글 {p.commentCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 게시판 카드: 자유/질문/팁/후기, 카드당 최신 3개 */}
      <section aria-labelledby="board-cards-heading">
        <h2 id="board-cards-heading" className="text-lg font-semibold mb-4">게시판</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["free", "qna", "tips", "reviews"] as const).map((slug) => {
            const name = BOARD_LABELS[slug] ?? boards.find((b) => b.slug === slug)?.name ?? slug;
            const items = latestByBoard[slug] ?? [];
            return (
              <div key={slug} className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4">
                <Link href={`/community/${slug}`} className="font-semibold text-site-text hover:text-site-primary block mb-3">
                  {name}
                </Link>
                <ul className="space-y-2">
                  {items.length === 0 && <li className="text-sm text-gray-500">글이 없습니다.</li>}
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/community/${slug}/${item.id}`} className="text-sm text-gray-700 dark:text-gray-300 hover:text-site-primary line-clamp-1 block">
                        {item.title}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {item.authorName} · {new Date(item.createdAt).toLocaleDateString("ko-KR")} · 추천 {item.likeCount}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href={`/community/${slug}`} className="mt-3 text-sm text-site-primary hover:underline block">
                  더보기 →
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 난구해결사 강조 카드 */}
      <section aria-labelledby="trouble-heading" className="rounded-2xl border-2 border-site-primary/30 bg-gradient-to-br from-site-primary/5 to-transparent dark:from-site-primary/10 p-6">
        <h2 id="trouble-heading" className="text-xl font-bold text-site-text mb-2">난구해결사</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          당구 문제를 올리고 해법을 나누는 공간입니다. 문제풀기와 등록을 통해 함께 풀어보세요.
        </p>
        <div className="flex flex-wrap gap-4 mb-4">
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-3 py-1 text-sm font-medium">
            진행중 {troubleStats.open}건
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-3 py-1 text-sm font-medium">
            해결 {troubleStats.solved}건
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/community/trouble"
            className="inline-flex items-center justify-center rounded-lg bg-site-primary text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
          >
            문제풀기
          </Link>
          <Link
            href="/community/trouble/write"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text px-5 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            등록
          </Link>
        </div>
      </section>
    </div>
  );
}
