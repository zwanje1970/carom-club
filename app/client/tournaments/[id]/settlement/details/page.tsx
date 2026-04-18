import { redirect } from "next/navigation";

/** 대회 경로 정산 UI 제거 — 정산 허브로만 안내 */
export default function TournamentSettlementDetailsRedirectPage() {
  redirect("/client/settlement");
}
