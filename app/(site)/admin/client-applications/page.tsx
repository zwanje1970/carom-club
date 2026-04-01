import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiClipboardCheck } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { ClientApplicationsList } from "./ClientApplicationsList";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";

export default async function AdminClientApplicationsPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  const copy = await getAdminCopy();

  return (
    <SectionMain>
      <SectionTitleLineWithButton
        icon={mdiClipboardCheck}
        title={getCopyValue(copy, "admin.clientApplications.pageTitle")}
      />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        {getCopyValue(copy, "admin.clientApplications.pageIntro")}{" "}
        <strong>{getCopyValue(copy, "admin.clientApplications.pageIntroStrong")}</strong>
      </p>
      <ClientApplicationsList copy={copy} />
    </SectionMain>
  );
}
