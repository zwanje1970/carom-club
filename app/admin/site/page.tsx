import { redirect } from "next/navigation";

/** 사이트 관리 허브 제거: 좌측 사이드바 '사이트관리' > '메인페이지 관리' 등에서 진입 */
export default function AdminSitePage() {
  redirect("/admin/site/main");
}
