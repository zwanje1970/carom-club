import { NextResponse } from "next/server";
import type { TournamentsListTab } from "@/lib/db-tournaments";
import { getPublicTournamentsListFromQuery, PUBLIC_TOURNAMENTS_TABS } from "@/lib/public-tournaments-list-request";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 공개 대회 목록. query: tab, sortBy, national, lat, lng */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }
  const { searchParams } = new URL(request.url);
  const tabParam = searchParams.get("tab");
  if (
    tabParam != null &&
    tabParam !== "" &&
    !PUBLIC_TOURNAMENTS_TABS.includes(tabParam as TournamentsListTab)
  ) {
    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  }

  const { list } = await getPublicTournamentsListFromQuery(searchParams);
  return NextResponse.json(list);
}
