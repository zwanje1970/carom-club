import { redirect } from "next/navigation";

export const metadata = { title: "참가자 관리" };

export default async function ClientOperationsTournamentParticipantsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  redirect(`/client/tournaments/${tournamentId}/participants`);
}
