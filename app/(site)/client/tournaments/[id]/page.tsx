import { redirect } from "next/navigation";

/** 대회 상세 진입은 운영 콘솔의 대회현황으로 통합 */
export default async function ClientTournamentDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/operations/tournaments/${id}`);
}
