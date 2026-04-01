import { mdiMessageQuestion } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";

export default async function AdminInquiriesPage() {
  const copy = await getAdminCopy();

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiMessageQuestion} title={getCopyValue(copy, "admin.inquiries.pageTitle")} />
      <CardBox>
        <p className="text-gray-600 dark:text-slate-400">{getCopyValue(copy, "admin.inquiries.pageIntro")}</p>
      </CardBox>
    </SectionMain>
  );
}
