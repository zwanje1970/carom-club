import Link from "next/link";
import { mdiImageText } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import HeroSettingsForm from "@/app/admin/settings/hero/HeroSettingsForm";
import { getPageSectionsForPage } from "@/lib/content/service";

export default async function AdminSiteHeroPage() {
  const homeSections = await getPageSectionsForPage("home");
  const heroCmsSection = homeSections.find(
    (s) => s.placement === "main_visual_bg" && s.type === "image"
  );

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link
          href="/admin/site/main"
          className="text-site-primary hover:underline"
        >
          ← 메인페이지 구성
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiImageText} title="히어로 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인페이지 상단 히어로(배경·텍스트·버튼·높이 등)를 설정합니다. 저장 후 메인에 바로 반영됩니다.
        아래에서 &quot;신규 히어로&quot;를 끄면, CMS의 메인 비주얼 이미지 섹션·고정문구가 사용됩니다.
      </p>
      <CardBox>
        <HeroSettingsForm />
      </CardBox>
      <CardBox className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
          구형 메인 비주얼 (CMS 이미지 섹션)
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          히어로 설정에서 사용 여부를 끈 경우, 아래 CMS 섹션의 배너 이미지·버튼·페이지별 문구가 메인 상단에 쓰입니다.
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
