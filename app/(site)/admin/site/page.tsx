"use client";

/**
 * 사이트관리 대시보드 (허브)
 * - 테마 미리보기, 활성 공지/팝업, 홈 pageBlocks 기준 노출 블록 수, 바로가기
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
  mdiForum,
  mdiSitemap,
  mdiBrushVariant,
} from "@mdi/js";
import Icon from "@/components/admin/_components/Icon";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import type { PageSection } from "@/types/page-section";
import {
  applyPublicHeroSingleCanonical,
  filterPageBlocksForPublicView,
} from "@/lib/content/filter-page-blocks-public-view";
import { SECTION_TYPE_LABELS } from "@/lib/content/constants";

type HubStats = {
  activeNoticeBars: number;
  activePopups: number;
  /** 공개 홈 `pageBlocks`와 동일 규칙(표시·기간·슬롯 포함)으로 센 노출 블록 수 */
  visibleHomeBlockCount: number;
  primaryColor: string;
  heroEnabled: boolean;
  footerEnabled: boolean;
  /** 홈에 공개 조건으로 노출되는 블록 목록(빌더 순서) */
  homeVisibleStack: PageSection[];
};

const SHORTCUTS = [
  { href: "/admin/page-builder", label: "페이지 빌더 (구조)", icon: mdiSitemap, desc: "홈·커뮤니티·대회 순서·표시·슬롯" },
  { href: "/admin/page-sections", label: "콘텐츠 편집 (CMS)", icon: mdiFormatListBulleted, desc: "텍스트·이미지·버튼만 수정" },
  { href: "/admin/site/color-theme", label: "색상 테마", icon: mdiBrushVariant, desc: "검증된 프리셋으로 전역 색상 적용" },
  { href: "/admin/site/settings", label: "디자인/브랜드 설정", icon: mdiPalette, desc: "로고, 수동 색, 헤더 색, 캐러셀 속도, 탈퇴 재가입" },
  { href: "/admin/site/home", label: "홈 화면 설정", icon: mdiPageLayoutBody, desc: "메인 구성·히어로로 이동" },
  { href: "/admin/site/community", label: "커뮤니티 설정", icon: mdiPageLayoutBody, desc: "해법 제시 최소 레벨 등 정책" },
  { href: "/admin/site/hero", label: "히어로 설정", icon: mdiViewCarousel, desc: "메인 상단 히어로(정본 편집)" },
  { href: "/admin/site/features", label: "기능 설정", icon: mdiViewCarousel, desc: "가입·대회 등 기능 ON/OFF" },
  { href: "/admin/settings/platform-billing", label: "플랫폼 빌링 설정", icon: mdiTable, desc: "대회 1회 이용권 및 연회원 가격 설정" },
  { href: "/admin/notice-bars", label: "공지바 관리", icon: mdiBullhorn, desc: "콘텐츠: 상단 공지줄" },
  { href: "/admin/popups", label: "팝업 관리", icon: mdiWindowRestore, desc: "콘텐츠: 레이어 팝업" },
  { href: "/admin/site/copy", label: "문구 관리", icon: mdiFormatListBulleted, desc: "메뉴명·안내 문구·고정 문구" },
  { href: "/admin/site/footer", label: "푸터 관리", icon: mdiTable, desc: "하단 푸터 정보·협력사" },
];

export default function AdminSiteDashboardPage() {
  const [stats, setStats] = useState<HubStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/content/notice-bars").then((r) => r.json()),
      fetch("/api/admin/content/popups").then((r) => r.json()),
      fetch("/api/admin/content/page-layout?page=home", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()),
      fetch("/api/admin/site-settings/hero").then((r) => r.json()).catch(() => ({ heroEnabled: false })),
    ])
      .then(([bars, popups, homeBlocks, site, hero]) => {
        const now = new Date().toISOString();
        const isActive = (b: { startAt?: string | null; endAt?: string | null; isVisible?: boolean }) =>
          b.isVisible !== false && (!b.startAt || b.startAt <= now) && (!b.endAt || b.endAt >= now);
        const rawHome = Array.isArray(homeBlocks) ? (homeBlocks as PageSection[]) : [];
        const homeVisibleStack = applyPublicHeroSingleCanonical(
          "home",
          filterPageBlocksForPublicView(rawHome)
        );
        setStats({
          activeNoticeBars: Array.isArray(bars) ? bars.filter(isActive).length : 0,
          activePopups: Array.isArray(popups) ? popups.filter(isActive).length : 0,
          visibleHomeBlockCount: homeVisibleStack.length,
          primaryColor: site?.primaryColor ?? "#991b1b",
          heroEnabled: hero?.heroEnabled ?? false,
          footerEnabled: site?.footer?.footerEnabled ?? false,
          homeVisibleStack,
        });
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const homeSections = stats?.homeVisibleStack ?? [];

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="사이트관리 대시보드" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        <strong>구조</strong>는「페이지 빌더」, <strong>CMS 내용</strong>은「콘텐츠 편집」에서 다룹니다. 브랜드·문구·히어로·팝업·공지는 아래
        바로가기와 왼쪽 메뉴를 이용하세요.
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
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                홈 노출 블록
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">CMS+슬롯, 공개와 동일 기준</p>
              <p className="mt-1 text-2xl font-semibold text-site-text">{stats?.visibleHomeBlockCount ?? 0}개</p>
              <Link href="/admin/page-builder" className="text-xs text-site-primary hover:underline mt-1 inline-block">
                페이지 빌더 →
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
              <h3 className="text-sm font-semibold text-site-text mb-3">홈에 지금 노출되는 블록 (pageBlocks 기준)</h3>
              <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                {homeSections.slice(0, 12).map((s) => (
                  <li key={s.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-site-text">
                      {s.slotType ? `슬롯: ${s.slotType}` : s.title || s.type}
                    </span>
                    <span className="text-xs text-gray-500">{s.slotType ? "슬롯" : SECTION_TYPE_LABELS[s.type]}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/page-builder" className="inline-block mt-3 text-sm text-site-primary hover:underline">
                순서·표시 변경은 페이지 빌더 →
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
