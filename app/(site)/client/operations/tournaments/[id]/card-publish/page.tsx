import { redirect } from "next/navigation";

export const metadata = { title: "카드 발행" };

export default async function ClientOperationsTournamentCardPublishRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/tournaments/${id}/card-publish`);
}
