import { redirect } from "next/navigation";

export const metadata = { title: "대회현황" };

export default async function ClientOperationsTournamentStatusRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/tournaments/${id}`);
}
