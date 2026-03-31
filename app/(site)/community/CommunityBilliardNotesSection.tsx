"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKoreanDate } from "@/lib/format-date";

interface FeedItem {
  id: string;
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  createdAt: string;
  authorName: string;
}

export function CommunityBilliardNotesSection() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    fetch("/api/community/billiard-notes?visibility=community", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          setNeedLogin(true);
          return [];
        }
        setNeedLogin(false);
        return res.ok ? res.json() : [];
      })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-10" aria-labelledby="community-feed-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="community-feed-heading" className="text-lg font-semibold">커뮤니티에 게시된 난구노트</h2>
        <Link
          href="/community/notes"
          className="text-site-primary hover:underline text-sm"
        >
          전체 목록
        </Link>
      </div>
      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중…</p>
      ) : needLogin ? (
        <p className="text-gray-600 dark:text-slate-400 text-sm">
          커뮤니티에 게시된 난구노트는{" "}
          <Link href="/login?next=%2Fcommunity" className="text-site-primary font-medium hover:underline">
            로그인
          </Link>
          후 볼 수 있습니다.
        </p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">커뮤니티에 게시된 난구노트가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="난구노트 목록">
          {items.slice(0, 6).map((n) => (
            <li key={n.id}>
              <Link
                href={`/community/notes/${n.id}`}
                className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-slate-700">
                  {n.imageUrl ? (
                    <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">이미지 없음</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-site-text line-clamp-2 leading-snug">
                    {n.memo || "(메모 없음)"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {n.authorName} · {formatKoreanDate(n.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
