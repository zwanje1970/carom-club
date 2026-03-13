import { mdiViewDashboard } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { DashboardMenuBox } from "@/components/admin/DashboardMenuBox";
import { getAdminCopy } from "@/lib/admin-copy";
import { getMenuAside } from "@/components/admin/adminMenu";

export default async function AdminPage() {
  const copy = await getAdminCopy();
  const menuAside = getMenuAside(copy).filter((item) => item.href !== "/admin");

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="대시보드" main />
      <DashboardMenuBox menu={menuAside} />
    </SectionMain>
  );
}
