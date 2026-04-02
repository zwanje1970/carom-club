import { redirect } from "next/navigation";

/** 대진표 관리는 운영 콘솔 경로로 통합 */
export default async function ClientTournamentBracketRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/operations/tournaments/${id}/bracket`);
}
