"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { mdiViewDashboard } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import type { PageSection } from "@/types/page-section";
import { PLACEMENT_MINIMAP_LABELS } from "@/lib/content/constants";

type MainSectionItem = {
  id: string;
  key: string;
  label: string;
  type: "hero" | "cms" | "fixed" | "copy" | "settings";
  isVisible: boolean;
  editHref: string;
  section?: PageSection;
};

export default function AdminSiteMainPage() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/content/page-sections", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, []);

  const homeSections = sections.filter((s) => s.page === "home").sort((a, b) => a.sortOrder - b.sortOrder);
  const heroSection = homeSections.find((s) => s.placement === "main_visual_bg" && s.type === "image");
  const otherCms = homeSections.filter((s) => !(s.placement === "main_visual_bg" && s.type === "image"));

  const fixedBlocks: Omit<MainSectionItem, "section">[] = [
    { id: "tournaments_venues", key: "tournaments_venues", label: "진행중 대회 · 당구장 소개", type: "fixed", isVisible: true, editHref: "/admin/site/components" },
    { id: "quick_apply", key: "quick_apply", label: "빠른 참가 신청", type: "fixed", isVisible: true, editHref: "/admin/site/components" },
    { id: "notice_community", key: "notice_community", label: "공지 / 커뮤니티", type: "fixed", isVisible: true, editHref: "/admin/site/components" },
    { id: "location", key: "location", label: "위치 안내", type: "fixed", isVisible: true, editHref: "/admin/site/components" },
    { id: "footer", key: "footer", label: "푸터", type: "fixed", isVisible: true, editHref: "/admin/site/footer" },
    {
      id: "copy",
      key: "copy",
      label: "고정문구 · 페이지별 문구",
      type: "copy",
      isVisible: true,
      editHref: "/admin/site/copy",
    },
    {
      id: "settings",
      key: "settings",
      label: "사이트 설정 · 디자인/색상",
      type: "settings",
      isVisible: true,
      editHref: "/admin/site/settings",
    },
  ];

  const list: MainSectionItem[] = [];
  list.push({
    id: "hero",
    key: "hero",
    label: "히어로 (메인 비주얼)",
    type: "hero",
    isVisible: true,
    editHref: "/admin/site/hero",
    section: heroSection,
  });
  otherCms.forEach((s) => {
    list.push({
      id: s.id,
      key: s.id,
      label: s.title || `${s.type} (${PLACEMENT_MINIMAP_LABELS[s.placement] ?? s.placement})`,
      type: "cms",
      isVisible: s.isVisible,
      editHref: `/admin/page-sections/${s.id}/edit`,
      section: s,
    });
  });
  fixedBlocks.forEach((b) => list.push({ ...b }));

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="메인페이지 구성" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인페이지에 노출되는 섹션의 표시 여부와 순서를 관리하고, 각 섹션 편집으로 이동할 수 있습니다.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500 py-4">불러오는 중…</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {list.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30"
              >
                <span className="text-sm text-gray-500 w-8 shrink-0">{index + 1}</span>
                <span className={`shrink-0 w-8 h-8 flex items-center justify-center rounded ${item.isVisible ? "text-green-600" : "text-gray-400"}`} title={item.isVisible ? "표시" : "숨김"}>
                  {item.isVisible ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900 dark:text-slate-100">{item.label}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    (
                    {item.type === "hero"
                      ? "히어로"
                      : item.type === "cms"
                        ? "CMS 섹션"
                        : item.type === "copy"
                          ? "문구"
                          : item.type === "settings"
                            ? "설정"
                            : "고정 블록"}
                    )
                  </span>
                </div>
                <Link
                  href={item.editHref}
                  className="shrink-0 rounded-lg border border-site-border bg-white px-3 py-1.5 text-sm text-site-text hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  편집
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-slate-400 w-full mb-1">
            메인 관련 구조는 여기서 끝나게 정리합니다. 섹션 추가·순서 변경은 아래에서 할 수 있습니다.
          </p>
          <Button href="/admin/page-sections" label="페이지 섹션" color="info" small />
          <Button href="/admin/site/components" label="컴포넌트" color="info" small />
        </div>
      </CardBox>
    </SectionMain>
  );
}
