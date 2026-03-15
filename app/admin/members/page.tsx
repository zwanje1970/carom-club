import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiShieldAccount } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { AdminMembersList } from "./AdminMembersList";

export default async function AdminMembersPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiShieldAccount} title="권한관리" />
      <CardBox>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          회원/클라이언트/관리자 구분을 검색·필터·정렬로 조회하고, 권한·상태를 변경할 수 있습니다.
        </p>
        <AdminMembersList />
      </CardBox>
    </SectionMain>
  );
}
