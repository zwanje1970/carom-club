import { redirect } from "next/navigation";

/** 공동관리자는 대회 상세 탭에서 설정 — 대회관리로 안내 */
export default function ClientCoAdminsPage() {
  redirect("/client/tournaments");
}
