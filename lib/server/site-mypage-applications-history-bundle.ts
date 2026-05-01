import type { TournamentApplicationStatus } from "./platform-backing-store";
import { listTournamentApplicationsByUserIdFirestore } from "./firestore-tournament-applications";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
import type { Tournament } from "../types/entities";

export type MypageApplicationRowPayload = {
  applicationId: string;
  tournamentId: string;
  status: string;
  createdAt: string;
  tournamentTitle: string;
  tournamentDate: string;
};

export type MypageHistoryRowPayload = {
  applicationId: string;
  tournamentId: string;
  status: string;
  tournamentTitle: string;
  dateLine: string;
};

function isTournamentOngoing(dateText: string): boolean {
  const parsed = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= Date.now();
}

async function loadJoinedApplicationsWithTournaments(userId: string) {
  const applications = await listTournamentApplicationsByUserIdFirestore(userId);
  return Promise.all(
    applications.map(async (application) => ({
      application,
      tournament: await getTournamentByIdFirestore(application.tournamentId),
    })),
  );
}

/** `/api/site/mypage?part=applications` — 진행중·미완료 목록 */
export async function buildMypageActiveApplicationRows(userId: string): Promise<MypageApplicationRowPayload[]> {
  try {
    const applicationRows = await loadJoinedApplicationsWithTournaments(userId);
    const visibleStatuses: TournamentApplicationStatus[] = [
      "APPLIED",
      "VERIFYING",
      "WAITING_PAYMENT",
      "APPROVED",
    ];
    const visibleRows = applicationRows.filter((row) => {
      if (!row.tournament) return false;
      if (!visibleStatuses.includes(row.application.status)) return false;
      if (row.application.status === "APPROVED" || row.application.status === "APPLIED") {
        return isTournamentOngoing(row.tournament.date);
      }
      return true;
    });

    return visibleRows.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status,
      createdAt: row.application.createdAt,
      tournamentTitle: row.tournament?.title ?? "대회",
      tournamentDate: row.tournament?.date || row.application.createdAt.slice(0, 10),
    }));
  } catch (e) {
    console.warn("[site-mypage-bundle] buildMypageActiveApplicationRows", e);
    return [];
  }
}

/** `/api/site/mypage/history` — 종료·지난 기록 */
export async function buildMypageHistoryRows(userId: string): Promise<MypageHistoryRowPayload[]> {
  try {
    const rows = await loadJoinedApplicationsWithTournaments(userId);
    const historyRows = rows
      .filter((row) => {
        if (!row.tournament) return false;
        const ongoingApproved =
          row.application.status === "APPROVED" && isTournamentOngoing(row.tournament.date);
        const ongoingApplied =
          row.application.status === "APPLIED" && isTournamentOngoing(row.tournament.date);
        const ongoingIncomplete =
          row.application.status === "VERIFYING" || row.application.status === "WAITING_PAYMENT";
        const isActiveMypageItem = ongoingApproved || ongoingApplied || ongoingIncomplete;
        return !isActiveMypageItem;
      })
      .sort((a, b) => {
        const aTime = a.application.statusChangedAt || a.application.updatedAt || a.application.createdAt;
        const bTime = b.application.statusChangedAt || b.application.updatedAt || b.application.createdAt;
        return bTime.localeCompare(aTime);
      });

    return historyRows.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status as TournamentApplicationStatus,
      tournamentTitle: row.tournament?.title ?? "대회",
      dateLine: (row.application.statusChangedAt || row.application.updatedAt || row.application.createdAt).slice(0, 10),
    }));
  } catch (e) {
    console.warn("[site-mypage-bundle] buildMypageHistoryRows", e);
    return [];
  }
}

/**
 * 지난 대회 화면 등: 신청 목록 1회 로드 후 활성·이력 행을 함께 계산(Firestore 중복 조회 방지).
 */
export async function loadMypageApplicationsHistoryBundleForUserId(userId: string): Promise<{
  applicationRows: MypageApplicationRowPayload[];
  historyRows: MypageHistoryRowPayload[];
}> {
  try {
    const joined = await loadJoinedApplicationsWithTournaments(userId);

    const visibleStatuses: TournamentApplicationStatus[] = [
      "APPLIED",
      "VERIFYING",
      "WAITING_PAYMENT",
      "APPROVED",
    ];
    const activeRows = joined.filter((row) => {
      if (!row.tournament) return false;
      if (!visibleStatuses.includes(row.application.status)) return false;
      if (row.application.status === "APPROVED" || row.application.status === "APPLIED") {
        return isTournamentOngoing(row.tournament.date);
      }
      return true;
    });

    const applicationRows: MypageApplicationRowPayload[] = activeRows.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status,
      createdAt: row.application.createdAt,
      tournamentTitle: row.tournament?.title ?? "대회",
      tournamentDate: row.tournament?.date || row.application.createdAt.slice(0, 10),
    }));

    const historyJoined = joined
      .filter((row) => {
        if (!row.tournament) return false;
        const ongoingApproved =
          row.application.status === "APPROVED" && isTournamentOngoing(row.tournament.date);
        const ongoingApplied =
          row.application.status === "APPLIED" && isTournamentOngoing(row.tournament.date);
        const ongoingIncomplete =
          row.application.status === "VERIFYING" || row.application.status === "WAITING_PAYMENT";
        const isActiveMypageItem = ongoingApproved || ongoingApplied || ongoingIncomplete;
        return !isActiveMypageItem;
      })
      .sort((a, b) => {
        const aTime = a.application.statusChangedAt || a.application.updatedAt || a.application.createdAt;
        const bTime = b.application.statusChangedAt || b.application.updatedAt || b.application.createdAt;
        return bTime.localeCompare(aTime);
      });

    const historyRows: MypageHistoryRowPayload[] = historyJoined.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status as TournamentApplicationStatus,
      tournamentTitle: row.tournament?.title ?? "대회",
      dateLine: (row.application.statusChangedAt || row.application.updatedAt || row.application.createdAt).slice(0, 10),
    }));

    return { applicationRows, historyRows };
  } catch (e) {
    console.warn("[site-mypage-bundle] loadMypageApplicationsHistoryBundleForUserId", e);
    return { applicationRows: [], historyRows: [] };
  }
}
