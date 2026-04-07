import Link from "next/link";
import { mdiViewDashboard } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { PLATFORM_CARD_TEMPLATES_MENU_LABEL } from "@/lib/platform-card-templates";

export default async function AdminPlatformPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="플랫폼 대시보드" main />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <CardBox>
          <Link href="/admin/venues" className="block min-h-[44px] touch-manipulation py-1">
            <p className="text-base font-semibold text-site-text">클라이언트 관리</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/client-applications" className="block min-h-[44px] touch-manipulation py-1">
            <p className="text-base font-semibold text-site-text">승인 관리</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/members" className="block min-h-[44px] touch-manipulation py-1">
            <p className="text-base font-semibold text-site-text">회원·권한 관리</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/fee-ledger" className="block min-h-[44px] touch-manipulation py-1">
            <p className="text-base font-semibold text-site-text">정산/결제</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/platform/card-templates" className="block min-h-[44px] touch-manipulation py-1">
            <p className="text-base font-semibold text-site-text">{PLATFORM_CARD_TEMPLATES_MENU_LABEL}</p>
          </Link>
        </CardBox>
      </div>
    </SectionMain>
  );
}
