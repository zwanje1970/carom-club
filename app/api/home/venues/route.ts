import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVenuesListWithCoords } from "@/lib/db-tournaments";
import { haversineKm } from "@/lib/distance";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { normalizeSlugs } from "@/lib/normalize-slug";

export type HomeVenueItem = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  distanceKm?: number | null;
};

/** 메인 당구장 목록. ?lat=&lng= 있으면 가까운 순, 없으면 로그인 시 회원 좌표 사용, 없으면 기존 정렬. */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(request.url);
  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));
  const take = Math.min(Number(searchParams.get("take")) || 6, 150);

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

  const list = await getVenuesListWithCoords(take * 3);
  const listNorm = normalizeSlugs(list);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasCoords) {
    const out: HomeVenueItem[] = listNorm.slice(0, take).map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      coverImageUrl: v.coverImageUrl,
    }));
    return NextResponse.json(out);
  }

  const withDistance = listNorm.map((v) => {
    const km = haversineKm(lat, lng, v.latitude, v.longitude);
    return { ...v, distanceKm: km };
  });
  withDistance.sort((a, b) => {
    const ka = a.distanceKm;
    const kb = b.distanceKm;
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka - kb;
  });

  const out: HomeVenueItem[] = withDistance.slice(0, take).map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    coverImageUrl: v.coverImageUrl,
    distanceKm: v.distanceKm ?? undefined,
  }));
  return NextResponse.json(out);
}
