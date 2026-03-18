import { redirect } from "next/navigation";

/** 푸터는 메인페이지 관리에서만 편집 (구 /admin/settings/footer 북마크 호환) */
export default function AdminSettingsFooterRedirectPage() {
  redirect("/admin/site/footer");
}
