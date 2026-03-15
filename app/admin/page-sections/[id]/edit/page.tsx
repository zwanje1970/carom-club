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

export default function EditPageSectionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [section, setSection] = useState<PageSection | null | undefined>(undefined);
  const [allSections, setAllSections] = useState<PageSection[]>([]);

  useEffect(() => {
    if (!id) return;
    fetch("/api/admin/content/page-sections")
      .then((res) => res.json())
      .then((data: PageSection[]) => {
        const list = Array.isArray(data) ? data : [];
        setAllSections(list);
        const found = list.find((s) => s.id === id) ?? null;
        setSection(found);
      })
      .catch(() => setSection(null));
  }, [id]);

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

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="페이지 섹션 수정">
        <div className="flex items-center gap-2">
          <Button href="/admin/site" label="사이트 관리" color="contrast" small />
          <Button href="/admin/page-sections" label="← 목록" color="contrast" small />
        </div>
      </SectionTitleLineWithButton>
      <CardBox className="max-w-4xl">
        <PageSectionForm
          initial={section}
          sections={allSections}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/page-sections")}
        />
      </CardBox>
    </SectionMain>
  );
}
