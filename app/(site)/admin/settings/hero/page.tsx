import { redirect } from "next/navigation";

/** 히어로는 메인페이지 관리에서만 편집 (구 /admin/settings/hero 북마크 호환) */
export default function AdminSettingsHeroRedirectPage() {
  redirect("/admin/site/hero");
}
