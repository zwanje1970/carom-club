"use client";

import { useState, useEffect } from "react";
import { mdiFormatListBulleted, mdiPlus } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { PageSectionList } from "@/components/admin/page-sections/PageSectionList";
import type { PageSection } from "@/types/page-section";

export default function AdminPageSectionsPage() {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageFilter, setPageFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [visibleFilter, setVisibleFilter] = useState("");

  const refetch = () => {
    fetch("/api/admin/content/page-sections", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]));
  };

  useEffect(() => {
    fetch("/api/admin/content/page-sections", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 섹션을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/content/page-sections?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제에 실패했습니다.");
      return;
    }
    refetch();
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="페이지 섹션 관리">
        <div className="flex items-center gap-2">
          <Button href="/admin/site" label="설정 · 사이트 관리" color="contrast" small />
          <Button href="/admin/page-sections/new" icon={mdiPlus} label="섹션 추가" color="info" small />
        </div>
      </SectionTitleLineWithButton>
      <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
        사이트 페이지에 이미지·텍스트·버튼 섹션을 배치할 수 있습니다. (설정 → 사이트 관리 → 컴포넌트 관리)
      </p>
      <p className="mb-6 text-sm text-amber-700 dark:text-amber-400">
        <strong>메인 상단 히어로</strong>: 사이트관리 → 메인페이지 관리 → 히어로 편집에서 신규 히어로를 켠 경우 그 설정이 우선합니다. 신규 히어로를 끈 경우에만 아래처럼 CMS 섹션을 씁니다. [노출 페이지: 메인페이지] → [노출 위치: 메인 비주얼 배경]으로 필터해 수정하거나, [섹션 추가]로 유형 &quot;이미지&quot;, 위치 &quot;메인 비주얼 배경&quot;으로 만드세요.
      </p>
      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <PageSectionList
            sections={sections}
            pageFilter={pageFilter}
            placementFilter={placementFilter}
            visibleFilter={visibleFilter}
            onPageFilterChange={setPageFilter}
            onPlacementFilterChange={setPlacementFilter}
            onVisibleFilterChange={setVisibleFilter}
            onDelete={handleDelete}
            onReorderRefetch={refetch}
          />
        )}
      </CardBox>
    </SectionMain>
  );
}
