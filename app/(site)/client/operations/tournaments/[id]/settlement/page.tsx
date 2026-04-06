import { redirect } from "next/navigation";

export const metadata = { title: "정산" };

export default async function ClientOperationsTournamentSettlementRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  redirect(`/client/tournaments/${tournamentId}/settlement`);
}
