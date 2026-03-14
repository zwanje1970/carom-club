import { redirect } from "next/navigation";

/** 공통 디자인 설정: 사이트 설정(테마·기본 색상)으로 이동 */
export default function AdminSiteDesignPage() {
  redirect("/admin/settings/site");
}
