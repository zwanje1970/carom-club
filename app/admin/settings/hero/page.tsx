import { mdiImageText } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import HeroSettingsForm from "./HeroSettingsForm";

export default function AdminSettingsHeroPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiImageText} title="메인 히어로 설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        메인페이지 상단 히어로 영역의 배경, 텍스트, 버튼을 설정합니다. 저장 후 메인페이지에 즉시 반영됩니다.
      </p>
      <CardBox>
        <HeroSettingsForm />
      </CardBox>
    </SectionMain>
  );
}
