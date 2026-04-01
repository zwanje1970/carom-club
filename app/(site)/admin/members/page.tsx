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
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";

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
      <SectionTitleLineWithButton icon={mdiShieldAccount} title={getCopyValue(copy, "admin.members.pageTitle")} />
      <CardBox>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
          {getCopyValue(copy, "admin.members.pageIntro")}
        </p>
        <AdminMembersList copy={copy} />
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
