import { mdiCashMultiple } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { getFeeLedgerData } from "./getFeeLedgerData";
import FeeLedgerPageClient from "./FeeLedgerPageClient";

export default async function AdminFeeLedgerPage() {
  let data;
  try {
    data = await getFeeLedgerData();
  } catch (e) {
    console.error("[admin/fee-ledger] getFeeLedgerData error:", e);
    data = {
      rows: [],
      payments: [],
      summary: { totalOrgs: 0, paidThisMonth: 0, arrearsCount: 0, totalAmount: 0 },
    };
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCashMultiple} title="정산" />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        클라이언트 정산 관리 — 회비·납부 현황을 조회합니다.
      </p>

      <CardBox>
        <FeeLedgerPageClient initialData={data} />
      </CardBox>
    </SectionMain>
  );
}
