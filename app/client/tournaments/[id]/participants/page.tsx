import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 레거시 URL — 대회 관리 메인으로 통합 */
export default async function ClientTournamentParticipantsPageRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  const q = f === "approved" || f === "wait" || f === "reject" ? `?f=${encodeURIComponent(f)}` : "";
  redirect(`/client/tournaments/${id}${q}`);
}
