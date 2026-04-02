import { redirect } from "next/navigation";

/** 참가자 관리는 운영 콘솔 경로로 통합 */
export default async function ClientTournamentParticipantsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/operations/tournaments/${id}/participants`);
}
