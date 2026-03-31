import { redirect } from "next/navigation";

/** 기능 설정은 사이트관리 메뉴로 이동 (북마크 호환) */
export default function AdminSettingsFeaturesRedirectPage() {
  redirect("/admin/site/features");
}
