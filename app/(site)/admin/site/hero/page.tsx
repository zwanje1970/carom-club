import Link from "next/link";
import { mdiImageText } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import HeroSettingsForm from "@/app/(site)/admin/settings/hero/HeroSettingsForm";
import { getPageSectionsForPage } from "@/lib/content/service";

export default async function AdminSiteHeroPage() {
  const homeSections = await getPageSectionsForPage("home");
  const heroCmsSection = homeSections.find(
    (s) => s.placement === "main_visual_bg" && s.type === "image"
  );

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site/home" className="text-site-primary hover:underline">
          ← 홈 화면 설정
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiImageText} title="히어로 설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        메인 상단 히어로의 <strong>유일한 편집 화면</strong>입니다. 배경(업로드)·제목·버튼·높이는 모두 여기서만 바꿉니다.
        저장 후 공개 메인에 반영됩니다(캐시로 최대 약 60초 지연 가능). &quot;히어로 사용&quot;을 끄면 레거시 폴백(아래 CMS
        섹션)이 사용됩니다.
      </p>
      <CardBox>
        <HeroSettingsForm />
      </CardBox>
      <CardBox className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
          레거시 폴백: 메인 비주얼 섹션 (콘텐츠 관리)
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          히어로를 끈 경우에만 메인 비주얼 섹션의 이미지·버튼이 폴백으로 쓰입니다. 제목·스타일 문구는 이 화면의 JSON 히어로가
          정본이며, 섹션 편집에서는 더 이상 히어로 전용 문구를 수정하지 않습니다.
        </p>
        {heroCmsSection ? (
          <Link
            href={`/admin/page-sections/${heroCmsSection.id}/edit`}
            className="inline-flex rounded-lg border border-site-border bg-white px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            메인 비주얼 이미지 섹션 편집
          </Link>
        ) : (
          <Link
            href="/admin/page-sections"
            className="inline-flex rounded-lg border border-site-border bg-white px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            페이지 섹션에서 &quot;메인 비주얼 배경&quot; 이미지 섹션 추가
          </Link>
        )}
      </CardBox>
    </SectionMain>
  );
}
