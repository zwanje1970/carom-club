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
      <SectionTitleLineWithButton icon={mdiCashMultiple} title="전체 회비 장부" />

      <CardBox>
        <FeeLedgerPageClient initialData={data} />
      </CardBox>
    </SectionMain>
  );
}
