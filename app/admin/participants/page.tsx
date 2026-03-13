import { mdiAccountGroup } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

export default function AdminParticipantsPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiAccountGroup} title="참가자관리" />
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400">
          대회별 참가자 목록은 해당 대회 상세 → 참가자 관리에서 확인할 수 있습니다.
        </p>
      </CardBox>
    </SectionMain>
  );
}
