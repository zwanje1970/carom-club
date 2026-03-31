import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { mdiHistory } from "@mdi/js";
import Link from "next/link";

export default function AdminMembersActivityPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiHistory} title="회원 활동 로그" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        회원별 활동 이력을 조회합니다.
      </p>
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400 mb-4">
          회원 활동 로그 기능은 준비 중입니다. 관리자 운영 로그는 운영관리 메뉴에서 확인할 수 있습니다.
        </p>
        <Link
          href="/admin/settings/admin-logs"
          className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          운영 로그 보기
        </Link>
      </CardBox>
    </SectionMain>
  );
}
