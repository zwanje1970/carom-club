import { redirect } from "next/navigation";

/** 컴포넌트 관리: 페이지 섹션(카드·배너·텍스트·이미지형) 통합 관리로 이동 */
export default function AdminSiteComponentsPage() {
  redirect("/admin/page-sections");
}
