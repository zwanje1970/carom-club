import Link from "next/link";
import { mdiPageLayoutFooter } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import FooterSettingsForm from "@/app/(site)/admin/settings/footer/FooterSettingsForm";

export default function AdminSiteFooterPage() {
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
      <SectionTitleLineWithButton icon={mdiPageLayoutFooter} title="푸터 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인·대시보드 하단 푸터의 배경/글자색, 주관사 정보, 협력업체(카드사·광고·후원)를 설정합니다. 푸터 사용을 켜야 노출됩니다.
      </p>
      <CardBox>
        <FooterSettingsForm />
      </CardBox>
      <CardBox className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
          관리자 화면 하단 문구
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
          푸터 사용을 끈 경우 관리자 레이아웃 하단에 표시되는 짧은 문구는 고정문구에서 바꿀 수 있습니다.
        </p>
        <Link
          href="/admin/site/copy"
          className="inline-flex rounded-lg border border-site-border bg-white px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          고정문구 · 페이지별 문구로 이동
        </Link>
      </CardBox>
    </SectionMain>
  );
}
