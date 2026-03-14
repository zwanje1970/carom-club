import { redirect } from "next/navigation";

/** 히어로 설정 전용 화면: 기존 메인 히어로 설정으로 이동 */
export default function AdminSiteHeroPage() {
  redirect("/admin/settings/hero");
}
