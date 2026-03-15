import { prisma } from "@/lib/db";
import { sendPushToUsers } from "./sendPush";

/**
 * 대회 시작 12시간 전 경기장 안내 푸시 발송.
 * 호출 시점 기준으로 startAt이 약 11~13시간 후인 대회를 대상으로 함.
 */
export async function sendVenueReminders(): Promise<{ sent: number; tournaments: number }> {
  const now = new Date();
  const in11h = new Date(now.getTime() + 11 * 60 * 60 * 1000);
  const in13h = new Date(now.getTime() + 13 * 60 * 60 * 1000);

  const tournaments = await prisma.tournament.findMany({
    where: {
      startAt: { gte: in11h, lte: in13h },
      status: { in: ["OPEN", "CLOSED", "BRACKET_GENERATED"] },
    },
    include: {
      matchVenues: { orderBy: { sortOrder: "asc" }, take: 1 },
      entries: { where: { status: "CONFIRMED" }, select: { userId: true } },
    },
  });

  let totalSent = 0;
  for (const t of tournaments) {
    const userIds = t.entries.map((e) => e.userId);
    if (userIds.length === 0) continue;

    const start = new Date(t.startAt);
    const dateStr = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`;
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayStr = dayNames[start.getDay()];
    const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    const venueLabel = t.matchVenues[0]?.displayLabel ?? t.venue ?? "당구장";
    const title = `${dateStr}(${dayStr}) ${timeStr} ${venueLabel} 시합입니다.`;
    const body = "늦지 않게 도착하세요.\n지각, 불참 시 실격 처리됩니다.";

    const result = await sendPushToUsers(userIds, {
      tournamentId: t.id,
      type: "VENUE_REMINDER",
      title,
      body,
      url: `/tournaments/${t.id}`,
    });
    totalSent += result.sent;
  }
  return { sent: totalSent, tournaments: tournaments.length };
}
