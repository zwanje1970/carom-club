"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { PageSectionForm } from "@/components/admin/page-sections/PageSectionForm";
import type { PageSection } from "@/types/page-section";

export default function NewPageSectionPage() {
  const router = useRouter();
  const [sections, setSections] = useState<PageSection[]>([]);

  useEffect(() => {
    fetch("/api/admin/content/page-sections")
      .then((res) => res.json())
      .then((data: PageSection[]) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]));
  }, []);

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

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="페이지 섹션 추가">
        <Button href="/admin/page-sections" label="← 목록" color="contrast" small />
      </SectionTitleLineWithButton>
      <CardBox className="max-w-4xl">
        <PageSectionForm
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/page-sections")}
        />
      </CardBox>
    </SectionMain>
  );
}
