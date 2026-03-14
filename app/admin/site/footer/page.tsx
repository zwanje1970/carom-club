import { redirect } from "next/navigation";

/** 푸터 설정 전용 화면: 기존 푸터 설정으로 이동 */
export default function AdminSiteFooterPage() {
  redirect("/admin/settings/footer");
}
