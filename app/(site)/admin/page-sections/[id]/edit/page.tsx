"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { PageSectionForm } from "@/components/admin/page-sections/PageSectionForm";
import type { PageSection } from "@/types/page-section";
import { isLegacyHomeHeroCmsBlock } from "@/lib/content/filter-page-blocks-public-view";

export default function EditPageSectionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [section, setSection] = useState<PageSection | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    fetch("/api/admin/content/page-sections")
      .then((res) => res.json())
      .then((data: PageSection[]) => {
        const list = Array.isArray(data) ? data : [];
        const found = list.find((s) => s.id === id) ?? null;
        setSection(found);
      })
      .catch(() => setSection(null));
  }, [id]);

  useEffect(() => {
    if (section === undefined || section === null) return;
    if (section.slotType === "hero" || isLegacyHomeHeroCmsBlock(section)) {
      router.replace("/admin/site/hero");
    }
  }, [section, router]);

  const handleSubmit = async (data: Omit<PageSection, "createdAt" | "updatedAt">) => {
    const res = await fetch("/api/admin/content/page-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "저장에 실패했습니다.");
    }
    router.refresh();
    router.push("/admin/page-sections");
  };

  if (section === undefined) {
    return (
      <SectionMain>
        <CardBox><p className="text-gray-500">불러오는 중…</p></CardBox>
      </SectionMain>
    );
  }
  if (section === null) {
    return (
      <SectionMain>
        <CardBox><p className="text-gray-500">섹션을 찾을 수 없습니다.</p></CardBox>
        <Button href="/admin/page-sections" label="목록으로" color="contrast" />
      </SectionMain>
    );
  }

  const heroCanonicalOnly =
    section.slotType === "hero" || isLegacyHomeHeroCmsBlock(section);

  if (heroCanonicalOnly) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="히어로 (정본)">
          <Button href="/admin/page-sections" label="← 목록" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl space-y-3 text-sm text-gray-700 dark:text-slate-300">
          <p>
            히어로 <strong>문구·이미지·버튼</strong>은 <strong className="text-site-text">사이트관리 → 히어로 설정</strong>
            에서만 편집합니다. 이 화면은 사용되지 않으며 히어로 설정으로 이동합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button href="/admin/site/hero" label="히어로 설정 열기" color="info" />
            <Button href="/admin/page-builder" label="페이지 빌더 (배치·노출)" color="contrast" small />
          </div>
        </CardBox>
      </SectionMain>
    );
  }

  if (section.slotType) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="구조 슬롯">
          <div className="flex flex-wrap gap-2">
            <Button href="/admin/page-builder" label="페이지 빌더" color="info" small />
            <Button href="/admin/page-sections" label="← 목록" color="contrast" small />
          </div>
        </SectionTitleLineWithButton>
        <CardBox className="max-w-xl space-y-3 text-sm text-gray-700 dark:text-slate-300">
          <p>
            이 행은 <strong>구조 슬롯</strong>({section.slotType})입니다. 순서·표시·이동·복제는{" "}
            <strong>페이지 빌더</strong>에서만 다룹니다.
          </p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="내용 편집 (CMS)">
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/admin/page-builder" label="페이지 빌더 (구조)" color="info" small />
          <Button href="/admin/page-sections" label="← 목록" color="contrast" small />
        </div>
      </SectionTitleLineWithButton>
      <p className="mb-4 max-w-4xl text-sm text-gray-600 dark:text-slate-400">
        이 화면에서는 콘텐츠(텍스트, 이미지, 버튼)만 수정합니다. 섹션 순서나 배치는 페이지 빌더에서 변경하세요.
      </p>
      <CardBox className="max-w-4xl">
        <PageSectionForm
          initial={section}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/page-sections")}
        />
      </CardBox>
    </SectionMain>
  );
}
