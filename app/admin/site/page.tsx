"use client";

/**
 * 사이트관리 대시보드 (허브)
 * - 현재 적용 테마 미리보기, 활성 공지/팝업 수, 노출 섹션, 바로가기 카드
 */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  mdiViewDashboard,
  mdiPalette,
  mdiPageLayoutBody,
  mdiViewCarousel,
  mdiBullhorn,
  mdiWindowRestore,
  mdiFormatListBulleted,
  mdiTable,
  mdiChevronRight,
} from "@mdi/js";
import Icon from "@/components/admin/_components/Icon";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import type { PageSection } from "@/types/page-section";

type HubStats = {
  activeNoticeBars: number;
  activePopups: number;
  visibleSections: number;
  primaryColor: string;
  heroEnabled: boolean;
  footerEnabled: boolean;
  sections: PageSection[];
};

const SHORTCUTS = [
  { href: "/admin/site/design", label: "스타일 설정", icon: mdiPalette, desc: "메인 컬러, 버튼·카드 스타일, 테두리·간격" },
  { href: "/admin/site/main", label: "메인페이지 구성", icon: mdiPageLayoutBody, desc: "섹션 노출/숨김, 순서, 제목·배경" },
  { href: "/admin/site/hero", label: "히어로 설정", icon: mdiViewCarousel, desc: "히어로 제목, 설명, 배경 이미지, 버튼" },
  { href: "/admin/notice-bars", label: "공지바 관리", icon: mdiBullhorn, desc: "상단 공지줄 제목·내용·노출 기간" },
  { href: "/admin/popups", label: "팝업 관리", icon: mdiWindowRestore, desc: "레이어 팝업 제목·본문·노출 기간" },
  { href: "/admin/site/copy", label: "문구 관리", icon: mdiFormatListBulleted, desc: "고정 문구, 메뉴명, 페이지 제목, 안내 문구" },
  { href: "/admin/site/footer", label: "푸터 관리", icon: mdiTable, desc: "로고, 소개, 연락처, 링크, 푸터 색상" },
];

export default function AdminSiteDashboardPage() {
  const [stats, setStats] = useState<HubStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/content/notice-bars").then((r) => r.json()),
      fetch("/api/admin/content/popups").then((r) => r.json()),
      fetch("/api/admin/content/page-sections").then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()),
      fetch("/api/admin/site-settings/hero").then((r) => r.json()).catch(() => ({ heroEnabled: false })),
    ])
      .then(([bars, popups, sections, site, hero]) => {
        const now = new Date().toISOString();
        const isActive = (b: { startAt?: string | null; endAt?: string | null; isVisible?: boolean }) =>
          b.isVisible !== false && (!b.startAt || b.startAt <= now) && (!b.endAt || b.endAt >= now);
        const sectionList = Array.isArray(sections) ? sections : [];
        const homeVisible = sectionList.filter((s: PageSection) => s.page === "home" && s.isVisible);
        setStats({
          activeNoticeBars: Array.isArray(bars) ? bars.filter(isActive).length : 0,
          activePopups: Array.isArray(popups) ? popups.filter(isActive).length : 0,
          visibleSections: homeVisible.length,
          primaryColor: site?.primaryColor ?? "#991b1b",
          heroEnabled: hero?.heroEnabled ?? false,
          footerEnabled: site?.footer?.footerEnabled ?? false,
          sections: sectionList,
        });
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const homeSections = stats?.sections?.filter((s) => s.page === "home").sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="사이트관리 대시보드" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        색상·메인 구성·히어로·공지·팝업·문구·푸터를 한 곳에서 확인하고 각 메뉴로 이동할 수 있습니다.
      </p>

      {loading ? (
        <p className="text-gray-500 py-4">불러오는 중…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">적용 테마</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-slate-600 shrink-0"
                  style={{ backgroundColor: stats?.primaryColor ?? "#991b1b" }}
                  aria-hidden
                />
                <span className="text-sm text-site-text">메인 컬러 적용 중</span>
              </div>
            </CardBox>
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">활성 공지바</p>
              <p className="mt-1 text-2xl font-semibold text-site-text">{stats?.activeNoticeBars ?? 0}개</p>
              <Link href="/admin/notice-bars" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                공지바 관리 →
              </Link>
            </CardBox>
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">활성 팝업</p>
              <p className="mt-1 text-2xl font-semibold text-site-text">{stats?.activePopups ?? 0}개</p>
              <Link href="/admin/popups" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                팝업 관리 →
              </Link>
            </CardBox>
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">노출 섹션</p>
              <p className="mt-1 text-2xl font-semibold text-site-text">{stats?.visibleSections ?? 0}개</p>
              <Link href="/admin/site/main" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                메인페이지 구성 →
              </Link>
            </CardBox>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">히어로</p>
              <p className="mt-1 text-sm font-medium text-site-text">{stats?.heroEnabled ? "표시" : "숨김"}</p>
              <Link href="/admin/site/hero" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                히어로 설정 →
              </Link>
            </CardBox>
            <CardBox className="p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">푸터</p>
              <p className="mt-1 text-sm font-medium text-site-text">{stats?.footerEnabled ? "표시" : "숨김"}</p>
              <Link href="/admin/site/footer" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                푸터 관리 →
              </Link>
            </CardBox>
          </div>

          {homeSections.length > 0 && (
            <CardBox className="mb-8">
              <h3 className="text-sm font-semibold text-site-text mb-3">현재 노출 섹션 목록 (메인)</h3>
              <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                {homeSections.slice(0, 10).map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                    <span className={s.isVisible ? "text-site-text" : "text-gray-400"}>{s.title || s.type}</span>
                    <span className="text-xs text-gray-500">{s.isVisible ? "표시" : "숨김"}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/site/main" className="inline-block mt-3 text-sm text-site-primary hover:underline">
                메인페이지 구성에서 순서·노출 변경 →
              </Link>
            </CardBox>
          )}

          <CardBox>
            <h3 className="text-sm font-semibold text-site-text mb-4">관리 메뉴 바로가기</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SHORTCUTS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-600 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-site-primary/10 text-site-primary">
                      <Icon path={item.icon} size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-site-text">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.desc}</p>
                    </div>
                    <Icon path={mdiChevronRight} size={20} className="text-gray-400 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBox>
        </>
      )}
    </SectionMain>
  );
}
