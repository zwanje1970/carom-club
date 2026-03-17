import { redirect } from "next/navigation";

/** 고정 문구 관리 → 메뉴·문구 통합 페이지로 리다이렉트 */
export default function AdminSettingsSystemTextPage() {
  redirect("/admin/settings/labels");
}
