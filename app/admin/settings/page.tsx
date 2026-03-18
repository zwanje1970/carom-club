import { redirect } from "next/navigation";

/** 설정 허브 제거: 좌측 사이드바 '사이트관리' / '운영관리' 메뉴에서 항목 선택 */
export default function AdminSettingsPage() {
  redirect("/admin");
}
