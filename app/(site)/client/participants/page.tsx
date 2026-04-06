import { redirect } from "next/navigation";

/** 호환: 전역 참가자 허브 → 참가 관리 */
export default function ClientParticipantsRedirectPage() {
  redirect("/client/tournaments");
}
