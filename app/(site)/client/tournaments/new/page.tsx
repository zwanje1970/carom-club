import { redirect } from "next/navigation";

/** 대회 등록은 운영 콘솔 경로로 통일 */
export default function ClientTournamentsNewRedirectPage() {
  redirect("/client/operations/tournaments/new");
}
