import { redirect } from "next/navigation";

/** 문구 통합: 메인페이지 관리에서만 편집 */
export default function AdminSettingsLabelsRedirectPage() {
  redirect("/admin/site/copy");
}
