import { mdiCashMultiple } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getCopyValue } from "@/lib/admin-copy";
import { getFeeLedgerData } from "./getFeeLedgerData";
import FeeLedgerPageClient from "./FeeLedgerPageClient";

export default async function AdminFeeLedgerPage() {
  const copy = await getAdminCopy();
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
      <SectionTitleLineWithButton icon={mdiCashMultiple} title={getCopyValue(copy, "admin.feeLedger.pageTitle")} />
      <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
        {getCopyValue(copy, "admin.feeLedger.pageIntro")}
      </p>

      <CardBox>
        <FeeLedgerPageClient initialData={data} copy={copy} />
      </CardBox>
    </SectionMain>
  );
}
