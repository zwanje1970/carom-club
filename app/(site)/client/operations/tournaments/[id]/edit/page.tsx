import { redirect } from "next/navigation";

export const metadata = { title: "대회 수정" };

export default async function ClientOperationsTournamentEditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/client/tournaments/${id}/edit`);
}
