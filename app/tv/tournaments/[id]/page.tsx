import { redirect } from "next/navigation";

export default async function TvTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tv/tournaments/${id}/overview`);
}
