import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { TvShareTabs } from "@/components/tv/TvShareTabs";

export default async function TvShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) notFound();

  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TvShareTabs
        token={token}
        tournamentName={tournament.name}
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name ?? zone.zone.name,
          code: zone.code ?? zone.zone.code,
        }))}
      />
      <main className="mx-auto w-full max-w-[1800px] px-5 py-5 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
