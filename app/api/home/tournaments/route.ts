import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTournamentsListWithOrgCoords, type TournamentListRow } from "@/lib/db-tournaments";
import { haversineKm } from "@/lib/distance";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type HomeTournamentItem = TournamentListRow & { distanceKm?: number | null };

/** 메인 대회 목록. ?lat=&lng= 있으면 주최 조직 좌표 기준 가까운 순. */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(request.url);
  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));
  const take = Math.min(Number(searchParams.get("take")) || 6, 50);

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (lat !== 0 || lng !== 0)) {
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

  const list = await getTournamentsListWithOrgCoords(take * 3);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  /** 접수중(OPEN) 대회를 상단에 노출: 1순위 OPEN, 2순위 나머지 */
  const openFirst = <T extends { status: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => (a.status === "OPEN" ? (b.status === "OPEN" ? 0 : -1) : b.status === "OPEN" ? 1 : 0));

  if (!hasCoords) {
    const sorted = openFirst(list).slice(0, take);
    const out: HomeTournamentItem[] = sorted.map((t) => ({
      id: t.id,
      name: t.name,
      startAt: t.startAt,
      endAt: t.endAt,
      status: t.status,
      organizationId: t.organizationId,
      venue: t.venue,
      venueName: t.venueName,
      gameFormat: t.gameFormat,
      imageUrl: t.imageUrl,
      organization: t.organization,
    }));
    return NextResponse.json(out);
  }

  const withDistance = list.map((t) => {
    const km = haversineKm(lat, lng, t.orgLatitude, t.orgLongitude);
    const { orgLatitude: _, orgLongitude: __, ...rest } = t;
    return { ...rest, distanceKm: km };
  });
  withDistance.sort((a, b) => {
    const openA = a.status === "OPEN" ? 0 : 1;
    const openB = b.status === "OPEN" ? 0 : 1;
    if (openA !== openB) return openA - openB;
    const ka = a.distanceKm;
    const kb = b.distanceKm;
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka - kb;
  });

  const out: HomeTournamentItem[] = withDistance.slice(0, take).map((t) => ({
    id: t.id,
    name: t.name,
    startAt: t.startAt,
    endAt: t.endAt,
    status: t.status,
    organizationId: t.organizationId,
    venue: t.venue,
    venueName: t.venueName,
    gameFormat: t.gameFormat,
    imageUrl: t.imageUrl,
    organization: t.organization,
    distanceKm: t.distanceKm ?? undefined,
  }));
  return NextResponse.json(out);
}
