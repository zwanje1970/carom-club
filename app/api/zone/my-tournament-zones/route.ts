import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAssignedTournamentZones } from "@/lib/auth-zone";

/** ZONE_MANAGER: 내가 관리할 수 있는 TournamentZone 목록 (대회별 권역). */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const list = await getAssignedTournamentZones(session);
  return NextResponse.json(list);
}
