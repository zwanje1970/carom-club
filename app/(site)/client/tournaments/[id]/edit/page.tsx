import { redirect } from "next/navigation";

/** 기본 정보 수정은 운영 콘솔(/client/operations)에서만 유지합니다. */
export default async function ClientTournamentEditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/operations/tournaments/${id}/edit`);
}
