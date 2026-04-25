import { redirect } from "next/navigation";

/**
 * 단수 경로(/client/tournament)는 예전·오입력용. 대회 목록·생성은 복수 경로(/client/tournaments)를 사용한다.
 * 이전 화면과 동일한 데이터를 다시 불러 오류를 유발하지 않도록 목록으로 보낸다.
 */
export default function ClientTournamentSingularRedirectPage() {
  redirect("/client/tournaments");
}
