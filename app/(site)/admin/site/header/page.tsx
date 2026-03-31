import { redirect } from "next/navigation";

/** 헤더 색상은 디자인/브랜드 설정 한 곳에서만 편집 (앵커로 이동) */
export default function AdminSiteHeaderRedirectPage() {
  redirect("/admin/site/settings#header-menu-colors");
}
