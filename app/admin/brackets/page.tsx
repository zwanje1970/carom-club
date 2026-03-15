import { mdiTable } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { ClientOnlyBlock } from "@/components/admin/ClientOnlyBlock";

export default async function AdminBracketsPage() {
  const session = await getSession();
  if (session && isPlatformAdmin(session)) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiTable} title="대진표 관리" />
        <ClientOnlyBlock title="대진표 관리는 클라이언트 관리자 전용입니다" />
      </SectionMain>
    );
  }
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTable} title="대진표 관리" />
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400">
          대진표는 각 대회 상세 페이지에서 생성·관리할 수 있습니다. 대회 선택 후 해당 대회의
          &quot;대진표 생성&quot; 버튼을 사용하세요.
        </p>
      </CardBox>
    </SectionMain>
  );
}
