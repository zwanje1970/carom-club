import { redirect } from "next/navigation";

/** 사이트·디자인 설정: 메인페이지 관리에서만 편집 */
export default function AdminSiteDesignRedirectPage() {
  redirect("/admin/site/settings");
}
