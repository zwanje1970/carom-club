import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getTournamentsListForPublicPage,
  type TournamentsListTab,
  type TournamentsListSort,
} from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TABS: TournamentsListTab[] = ["upcoming", "closed", "finished"];
const SORTS_UPCOMING: TournamentsListSort[] = ["distance", "deadline", "date"];
const SORTS_OTHER: TournamentsListSort[] = ["distance", "date"];

/** 공개 대회 목록. query: tab, sortBy, national, lat, lng */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") || "upcoming") as TournamentsListTab;
  const sortBy = (searchParams.get("sortBy") || "date") as TournamentsListSort;
  const national = searchParams.get("national") === "1";
  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));
  const take = Math.min(Number(searchParams.get("take")) || 200, 200);

  if (!TABS.includes(tab)) {
    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  }
  const allowedSorts = tab === "upcoming" ? SORTS_UPCOMING : SORTS_OTHER;
  const effectiveSort = allowedSorts.includes(sortBy) ? sortBy : "date";

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

  const list = await getTournamentsListForPublicPage({
    tab,
    sortBy: effectiveSort,
    nationalOnly: national,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    take,
  });

  return NextResponse.json(list);
}
