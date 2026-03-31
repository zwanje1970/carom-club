"use client";

import { mdiSitemap } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import Button from "@/components/admin/_components/Button";
import { PageBuilderClient } from "@/components/admin/page-builder/PageBuilderClient";

export default function AdminPageBuilderPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiSitemap} title="페이지 빌더 (구조)">
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/admin/page-sections" label="CMS 편집으로 이동" color="contrast" small />
          <Button href="/admin/site/hero" label="히어로 설정" color="contrast" small />
        </div>
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        이 화면에서는 섹션의 <strong>순서와 구조</strong>만 변경할 수 있습니다.
        <br />
        텍스트·이미지·버튼 내용은 <strong>콘텐츠 편집(CMS)</strong>에서 수정하세요.
      </p>
      <PageBuilderClient />
    </SectionMain>
  );
}
