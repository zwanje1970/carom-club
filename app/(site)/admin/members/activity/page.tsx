import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { mdiHistory } from "@mdi/js";

export default function AdminMembersActivityPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiHistory} title="회원 활동 로그" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        회원별 활동 이력을 조회합니다.
      </p>
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400">
          회원 활동 로그 기능은 준비 중입니다.
        </p>
      </CardBox>
    </SectionMain>
  );
}
