import { redirect } from "next/navigation";

/** 부/권역은 대회 상세에서 설정 — 대회관리로 안내 */
export default function ClientZonesPage() {
  redirect("/client/tournaments");
}
