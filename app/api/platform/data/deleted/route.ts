import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getUserById,
  listDeletedCommunityPostsForPlatformBackup,
  listDeletedMainSlideAdsForPlatformBackup,
  listDeletedTournamentPublishedCardsForPlatformBackup,
  listDeletedTournamentsForPlatformBackup,
  resolvePlatformAdminUserDisplayLabel,
} from "../../../../../lib/platform-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export type DeletedBackupRow = {
  id: string;
  title: string;
  kind: string;
  deletedAt: string;
  deletedBy: string;
  deletedByLabel: string;
  /** 있으면 표시 */
  deleteReason?: string;
  extra?: string;
};

export async function GET(request: Request) {
  const user = await requirePlatformUser();
  if (!user) {
    return NextResponse.json({ error: "플랫폼 관리자만 조회할 수 있습니다." }, { status: 403 });
  }

  const tab = new URL(request.url).searchParams.get("tab") ?? "tournaments";

  if (tab === "tournaments") {
    const list = await listDeletedTournamentsForPlatformBackup();
    const rows: DeletedBackupRow[] = await Promise.all(
      list.map(async (t) => ({
        id: t.id,
        title: t.title,
        kind: "대회",
        deletedAt: typeof t.deletedAt === "string" ? t.deletedAt : "",
        deletedBy: typeof t.deletedBy === "string" ? t.deletedBy : "",
        deletedByLabel: await resolvePlatformAdminUserDisplayLabel(
          typeof t.deletedBy === "string" ? t.deletedBy : "",
        ),
        deleteReason: typeof t.deleteReason === "string" && t.deleteReason.trim() ? t.deleteReason.trim() : undefined,
      })),
    );
    return NextResponse.json({ ok: true, tab, rows });
  }

  if (tab === "cards") {
    const list = await listDeletedTournamentPublishedCardsForPlatformBackup();
    const rows: DeletedBackupRow[] = await Promise.all(
      list.map(async (c) => ({
        id: c.snapshotId,
        title: c.title || "(제목 없음)",
        kind: "게시카드",
        deletedAt: typeof c.deletedAt === "string" ? c.deletedAt : "",
        deletedBy: typeof c.deletedBy === "string" ? c.deletedBy : "",
        deletedByLabel: await resolvePlatformAdminUserDisplayLabel(
          typeof c.deletedBy === "string" ? c.deletedBy : "",
        ),
        deleteReason: typeof c.deleteReason === "string" && c.deleteReason.trim() ? c.deleteReason.trim() : undefined,
        extra: c.tournamentId,
      })),
    );
    return NextResponse.json({ ok: true, tab, rows });
  }

  if (tab === "ads") {
    const list = await listDeletedMainSlideAdsForPlatformBackup();
    const rows: DeletedBackupRow[] = await Promise.all(
      list.map(async (a) => ({
        id: a.id,
        title: (a.adName ?? a.title ?? "").trim() || a.id,
        kind: "광고",
        deletedAt: typeof a.deletedAt === "string" ? a.deletedAt : "",
        deletedBy: typeof a.deletedBy === "string" ? a.deletedBy : "",
        deletedByLabel: await resolvePlatformAdminUserDisplayLabel(
          typeof a.deletedBy === "string" ? a.deletedBy : "",
        ),
        deleteReason: typeof a.deleteReason === "string" && a.deleteReason.trim() ? a.deleteReason.trim() : undefined,
      })),
    );
    return NextResponse.json({ ok: true, tab, rows });
  }

  if (tab === "posts") {
    const list = await listDeletedCommunityPostsForPlatformBackup();
    const rows: DeletedBackupRow[] = await Promise.all(
      list.map(async (p) => ({
        id: p.id,
        title: p.title,
        kind: "게시글",
        deletedAt: typeof p.deletedAt === "string" ? p.deletedAt : "",
        deletedBy: typeof p.deletedBy === "string" ? p.deletedBy : "",
        deletedByLabel: await resolvePlatformAdminUserDisplayLabel(
          typeof p.deletedBy === "string" ? p.deletedBy : "",
        ),
        deleteReason: typeof p.deleteReason === "string" && p.deleteReason.trim() ? p.deleteReason.trim() : undefined,
        extra: p.boardType,
      })),
    );
    return NextResponse.json({ ok: true, tab, rows });
  }

  return NextResponse.json({ error: "알 수 없는 탭입니다." }, { status: 400 });
}
