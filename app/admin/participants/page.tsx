import { redirect } from "next/navigation";

/** 참가자 관리는 대회 상세에서 진행 — 목록은 대회관리로 안내 */
export default function AdminParticipantsPage() {
  redirect("/admin/tournaments");
}
