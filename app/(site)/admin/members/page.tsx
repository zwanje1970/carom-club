import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiShieldAccount } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { AdminMembersList } from "./AdminMembersList";
import { CommunityMinLevelPolicyCard } from "./CommunityMinLevelPolicyCard";
import { WithdrawRejoinPolicyCard } from "./WithdrawRejoinPolicyCard";
import { hasAllPermissions, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

export default async function AdminMembersPage() {
  const session = await getSession();
  if (
    !session ||
    !(await hasAllPermissions(session, [
      PERMISSION_KEYS.ADMIN_ACCESS,
      PERMISSION_KEYS.ADMIN_USER_MANAGE,
    ]))
  ) {
    redirect("/admin/login");
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiShieldAccount} title="회원·권한 관리" />
      <CardBox>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          회원/클라이언트/관리자를 검색·필터·정렬로 조회하고 권한 및 상태를 변경할 수 있습니다.
        </p>
        <AdminMembersList />
      </CardBox>
      {session.role === "PLATFORM_ADMIN" ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <WithdrawRejoinPolicyCard />
          <CommunityMinLevelPolicyCard />
        </div>
      ) : null}
    </SectionMain>
  );
}
