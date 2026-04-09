import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiShieldAccount } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { AdminMembersList } from "./AdminMembersList";
import { CommunityMinLevelPolicyCard } from "./CommunityMinLevelPolicyCard";
import { WithdrawRejoinPolicyCard } from "./WithdrawRejoinPolicyCard";
import { hasAllPermissions, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { getAdminCopy } from "@/lib/admin-copy-server";

export default async function AdminMembersPage() {
  const copy = await getAdminCopy();
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
      <SectionTitleLineWithButton icon={mdiShieldAccount} title="권한관리" />
      <AdminMembersList copy={copy} view="permissionsOnly" />
      {session.role === "PLATFORM_ADMIN" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <WithdrawRejoinPolicyCard />
          <CommunityMinLevelPolicyCard />
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-slate-400">
          권한관리 설정은 플랫폼 관리자에게만 표시됩니다.
        </p>
      )}
    </SectionMain>
  );
}
