import { NextResponse } from "next/server";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { normalizeTournamentStatusBadge } from "../../../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

/** 신청 폼 등 공개 클라이언트용 최소 메타 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const badge = normalizeTournamentStatusBadge(tournament.statusBadge);
  const applicationsClosed = badge === "마감" || badge === "진행중" || badge === "종료";

  return NextResponse.json({
    statusBadge: badge,
    applicationsClosed,
    title: tournament.title ?? "",
  });
}
