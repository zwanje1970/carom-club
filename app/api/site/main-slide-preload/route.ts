import { NextResponse } from "next/server";
import { mainSlideTournamentImageUrlsFromSnapshots } from "../../../../lib/site/main-slide-preload-urls";
import {
  listTournamentSnapshotsForMainSite,
} from "../../../../lib/surface-read";
import {
  listTournamentSnapshotsForMainSite as loadMainTournamentSnapshotsDirect,
} from "../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

/** 앱 스플래시·경량 프리로드 — 메인 슬라이드 게시카드 이미지 URL만 반환(광고·공지 없음) */
export async function GET() {
  try {
    const snapshots =
      process.env.NODE_ENV === "development"
        ? await loadMainTournamentSnapshotsDirect()
        : await listTournamentSnapshotsForMainSite();
    const rows = Array.isArray(snapshots) ? snapshots : [];
    const imageUrls = mainSlideTournamentImageUrlsFromSnapshots(rows);
    return NextResponse.json({ imageUrls });
  } catch {
    return NextResponse.json({ imageUrls: [] });
  }
}
