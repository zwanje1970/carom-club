"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { mdiChartBox } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

type Status = {
  todayVisitors: number | null;
  currentOnline: number | null;
  todayTournaments: number;
  totalPosts: number;
  totalComments: number;
  totalReports: number;
  last24h: { tournaments: number; posts: number; comments: number; reports: number };
  recentTournaments: { id: string; name: string; createdAt: string }[];
  recentPosts: { id: string; title: string; boardSlug: string; boardName: string; authorName: string; createdAt: string }[];
  recentReports: { id: string; targetType: string; reason: string; status: string; reporterName: string; createdAt: string }[];
};

export default function AdminSettingsSystemStatusPage() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/system-status")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiChartBox} title="사이트 상태" />
        <CardBox><p className="text-gray-500">불러오는 중…</p></CardBox>
      </SectionMain>
    );
  }

  const s = data!;

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiChartBox} title="사이트 상태" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        운영 지표와 최근 24시간 활동, 최근 대회·게시글·신고 목록을 확인할 수 있습니다.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">오늘 방문자</p>
          <p className="text-2xl font-semibold text-site-text">
            {s.todayVisitors ?? "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">미측정</p>
        </CardBox>
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">현재 접속자</p>
          <p className="text-2xl font-semibold text-site-text">
            {s.currentOnline ?? "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">미측정</p>
        </CardBox>
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">오늘 생성 대회</p>
          <p className="text-2xl font-semibold text-site-text">{s.todayTournaments}</p>
        </CardBox>
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">게시글 수</p>
          <p className="text-2xl font-semibold text-site-text">{s.totalPosts}</p>
        </CardBox>
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">댓글 수</p>
          <p className="text-2xl font-semibold text-site-text">{s.totalComments}</p>
        </CardBox>
        <CardBox className="p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">신고 건수</p>
          <p className="text-2xl font-semibold text-site-text">{s.totalReports}</p>
        </CardBox>
      </div>

      <CardBox className="mb-6">
        <h3 className="font-semibold mb-3">최근 24시간 활동 요약</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><span className="text-gray-500">대회 생성 </span><strong>{s.last24h.tournaments}</strong>건</div>
          <div><span className="text-gray-500">게시글 </span><strong>{s.last24h.posts}</strong>건</div>
          <div><span className="text-gray-500">댓글 </span><strong>{s.last24h.comments}</strong>건</div>
          <div><span className="text-gray-500">신고 </span><strong>{s.last24h.reports}</strong>건</div>
        </div>
      </CardBox>

      <div className="grid md:grid-cols-3 gap-6">
        <CardBox>
          <h3 className="font-semibold mb-3">최근 생성된 대회</h3>
          <ul className="space-y-2 text-sm">
            {s.recentTournaments.length === 0 && <li className="text-gray-500">없음</li>}
            {s.recentTournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/tournaments/${t.id}`} className="text-site-primary hover:underline line-clamp-1">
                  {t.name}
                </Link>
                <span className="text-gray-500 text-xs ml-1">{new Date(t.createdAt).toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        </CardBox>
        <CardBox>
          <h3 className="font-semibold mb-3">최근 작성된 게시글</h3>
          <ul className="space-y-2 text-sm">
            {s.recentPosts.length === 0 && <li className="text-gray-500">없음</li>}
            {s.recentPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/community/posts/${p.id}`} className="text-site-primary hover:underline line-clamp-1">
                  {p.title}
                </Link>
                <span className="text-gray-500 text-xs block">[{p.boardName}] {p.authorName}</span>
              </li>
            ))}
          </ul>
        </CardBox>
        <CardBox>
          <h3 className="font-semibold mb-3">최근 신고 목록</h3>
          <ul className="space-y-2 text-sm">
            {s.recentReports.length === 0 && <li className="text-gray-500">없음</li>}
            {s.recentReports.map((r) => (
              <li key={r.id}>
                <Link href="/admin/community/reports" className="text-site-primary hover:underline">
                  {r.targetType} · {r.reason}
                </Link>
                <span className="text-gray-500 text-xs block">{r.reporterName} · {r.status}</span>
              </li>
            ))}
          </ul>
          <Link href="/community/admin/reports" className="mt-2 inline-block text-sm text-site-primary hover:underline">
            신고 관리 →
          </Link>
        </CardBox>
      </div>
    </SectionMain>
  );
}
