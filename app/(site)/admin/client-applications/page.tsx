import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiClipboardCheck } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { ClientApplicationsList } from "./ClientApplicationsList";

export default async function AdminClientApplicationsPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiClipboardCheck} title="클라이언트 신청" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        당구장·동호회·연맹·주최자·강사 신청을 검토하고 승인/거절하세요.{" "}
        <strong>승인 시 클라이언트(업체)가 새로 생성되고, 신청자 계정에 클라이언트 관리자 권한이 부여됩니다.</strong>
      </p>
      <ClientApplicationsList />
    </SectionMain>
  );
}
