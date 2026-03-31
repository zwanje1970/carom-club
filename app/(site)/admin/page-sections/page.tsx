"use client";

import { useState, useEffect } from "react";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { PageSectionList } from "@/components/admin/page-sections/PageSectionList";
import type { HeroSettings } from "@/lib/hero-settings";
import type { PageSection } from "@/types/page-section";

export default function AdminPageSectionsPage() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [heroSettings, setHeroSettings] = useState<HeroSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageFilter, setPageFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/content/page-sections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/site-settings/hero", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([data, hero]) => {
        setSections(Array.isArray(data) ? data : []);
        if (hero && typeof hero === "object" && !("error" in hero)) {
          setHeroSettings(hero as HeroSettings);
        } else {
          setHeroSettings(null);
        }
      })
      .catch(() => {
        setSections([]);
        setHeroSettings(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="콘텐츠 편집 (CMS)">
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/admin/page-builder" label="페이지 빌더 (구조)" color="info" small />
          <Button href="/admin/site" label="사이트관리" color="contrast" small />
        </div>
      </SectionTitleLineWithButton>
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        이 화면에서는 콘텐츠(텍스트, 이미지, 버튼)만 수정합니다.
        <br />
        섹션 순서나 배치는 <strong>페이지 빌더</strong>에서 변경하세요.
      </p>
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        메인 상단 <strong>히어로 문구·배경·버튼</strong>의 정본은{" "}
        <Button href="/admin/site/hero" label="히어로 설정" color="contrast" small className="align-middle" /> 입니다.
        JSON 히어로를 끈 경우에만「메인 비주얼 배경」이미지 CMS가 폴백으로 쓰입니다.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <PageSectionList
            sections={sections}
            heroSettings={heroSettings}
            pageFilter={pageFilter}
            placementFilter={placementFilter}
            onPageFilterChange={setPageFilter}
            onPlacementFilterChange={setPlacementFilter}
          />
        )}
      </CardBox>
    </SectionMain>
  );
}
