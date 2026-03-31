import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { AdminPricingPlansList } from "./AdminPricingPlansList";

export default async function AdminPricingPlansPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="요금제/상품" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        연회원, 패키지, 단일 기능 상품을 관리합니다. 가격은 DB에 저장되며, 무료 운영 시 0원 또는 수동 부여로 처리할 수 있습니다.
      </p>
      <AdminPricingPlansList />
    </SectionMain>
  );
}
