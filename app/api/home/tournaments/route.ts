import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getHomePublishedTournamentCards,
} from "@/lib/home-published-tournament-cards.server";
import {
  normalizeHomeTournamentSortBy,
  type HomePublishedTournamentCard,
} from "@/lib/home-published-tournament-cards";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type HomeTournamentItem = HomePublishedTournamentCard;

/** 메인 대회 목록. ?lat=&lng= 있으면 주최 조직 좌표 기준 가까운 순. */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(request.url);
  const sortBy = normalizeHomeTournamentSortBy(searchParams.get("sortBy"));
  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));
  const take = Math.min(Number(searchParams.get("take")) || 6, 50);

  if (
    sortBy === "distance" &&
    (!Number.isFinite(lat) || !Number.isFinite(lng)) &&
    (lat !== 0 || lng !== 0)
  ) {
    const session = await getSession();
    if (session?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { latitude: true, longitude: true },
      });
      if (user?.latitude != null && user?.longitude != null) {
        lat = user.latitude;
        lng = user.longitude;
      }
    }
  }

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const out = await getHomePublishedTournamentCards({
    sortBy,
    take,
    ...(hasCoords ? { lat, lng } : {}),
  });
  return NextResponse.json(out);
}
