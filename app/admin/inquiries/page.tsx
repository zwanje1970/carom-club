import { mdiMessageQuestion } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

export default function AdminInquiriesPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiMessageQuestion} title="문의관리" />
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400">문의 목록 및 답변 관리입니다.</p>
      </CardBox>
    </SectionMain>
  );
}
