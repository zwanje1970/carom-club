import { redirect } from "next/navigation";

/** 호환: 전역 대진표 허브는 대회 운영으로 통합 */
export default function ClientBracketsRedirectPage() {
  redirect("/client/operations");
}
