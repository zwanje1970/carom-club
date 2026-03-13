import { mdiPageLayoutFooter } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import Button from "@/components/admin/_components/Button";
import FooterSettingsForm from "./FooterSettingsForm";

export default function AdminSettingsFooterPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiPageLayoutFooter} title="푸터 설정">
        <Button href="/admin/settings" label="← 설정" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인·대시보드 하단 푸터의 배경/글자색, 주관사 정보, 협력업체(카드사·광고·후원)를 설정합니다. 푸터 사용을 켜야 노출됩니다.
      </p>
      <FooterSettingsForm />
    </SectionMain>
  );
}
