import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiAccountMultiple } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { AdminMembersList } from "./AdminMembersList";

export default async function AdminMembersPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiAccountMultiple} title="회원관리" />
      <CardBox>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          회원 목록입니다. 탈퇴 회원은 상태 필터에서 &quot;탈퇴&quot; 또는 &quot;전체&quot;로 조회할 수 있습니다.
        </p>
        <AdminMembersList />
      </CardBox>
    </SectionMain>
  );
}
