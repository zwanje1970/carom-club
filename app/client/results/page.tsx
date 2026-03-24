import { redirect } from "next/navigation";

/** 호환: 전역 결과 허브는 대회 운영으로 통합 */
export default function ClientResultsRedirectPage() {
  redirect("/client/operations");
}
