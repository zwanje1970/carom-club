import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { mdiFormatListBulleted } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { AdminListingProductsList } from "./AdminListingProductsList";

export default async function AdminListingProductsPage() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiFormatListBulleted} title="등록/게시 상품 정책" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        당구장 홍보, 대회 등록, 레슨 등록, 동호회 등록의 게시기간(개월)과 금액을 설정합니다. 일반업체에만 적용되며, 등록업체(연회원)는 적용 제외입니다.
      </p>
      <AdminListingProductsList />
    </SectionMain>
  );
}
