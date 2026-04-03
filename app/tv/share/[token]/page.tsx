import { redirect, notFound } from "next/navigation";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";

export default async function TvShareTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) notFound();
  redirect(`/tv/share/${token}/overview`);
}
