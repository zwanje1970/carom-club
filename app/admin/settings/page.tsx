import { redirect } from "next/navigation";

/** 설정 허브는 /admin/site 로 통일 */
export default function AdminSettingsPage() {
  redirect("/admin/site");
}
