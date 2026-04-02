import { redirect } from "next/navigation";

/** 신청자 처리는 대회현황(대회 단위)에서만 진행 */
export default function ClientOperationsParticipantsRedirectPage() {
  redirect("/client/operations");
}
