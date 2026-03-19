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

  useEffect(() => {
    fetch("/api/community/billiard-notes?visibility=community")
      .then((res) => (res.ok ? res.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-10" aria-labelledby="community-feed-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="community-feed-heading" className="text-lg font-semibold">커뮤니티에 게시된 노트</h2>
        <Link
          href="/community/notes"
          className="text-site-primary hover:underline text-sm"
        >
          전체 목록
        </Link>
      </div>
      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">커뮤니티에 게시된 노트가 없습니다.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.slice(0, 6).map((n) => (
            <li key={n.id}>
              <Link
                href={`/community/notes/${n.id}`}
                className="block rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <div className="aspect-[2/1] bg-gray-100 dark:bg-slate-700">
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
                <div className="p-2">
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {n.memo || "(메모 없음)"}
                  </p>
                  <p className="text-xs text-gray-400">
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
