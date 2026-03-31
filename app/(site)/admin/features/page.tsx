import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { AdminFeaturesList } from "./AdminFeaturesList";

export default async function AdminFeaturesPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="기능 목록" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        권한/노출 분기에 사용하는 기능 코드를 관리합니다. 요금제에 연결하면 해당 플랜 구독 조직이 사용할 수 있습니다.
      </p>
      <AdminFeaturesList />
    </SectionMain>
  );
}
