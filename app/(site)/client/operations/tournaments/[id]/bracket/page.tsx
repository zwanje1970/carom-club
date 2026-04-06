import { redirect } from "next/navigation";

export const metadata = { title: "대진표 보기·수정" };

export default async function ClientOperationsBracketRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  redirect(`/client/tournaments/${tournamentId}/bracket`);
}
