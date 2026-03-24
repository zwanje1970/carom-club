/**
 * 클라이언트 대회 운영 단계 표시 (반자동화 설계와 정렬)
 * @see docs/CLIENT_TOURNAMENT_SEMI_AUTOMATION.md
 */

export type OperationsPhaseView = "participants" | "roster" | "bracket-build" | "bracket" | "results";

export type TournamentOperationPhaseSnapshot = {
  status: string;
  participantRosterLockedAt: string | null;
  finalMatchCount: number;
  /** 향후: 대진 초안 JSON/행 존재 (스키마 추가 시) */
  hasBracketDraft?: boolean;
};

/** Prisma Tournament 조회 결과에서 단계 표시용 스냅샷 생성 */
export function toTournamentOperationPhaseSnapshot(t: {
  status: string;
  participantRosterLockedAt: Date | null;
  _count: { finalMatches: number };
}): TournamentOperationPhaseSnapshot {
  return {
    status: t.status,
    participantRosterLockedAt: t.participantRosterLockedAt?.toISOString() ?? null,
    finalMatchCount: t._count.finalMatches,
  };
}

export type OperationPhaseStepUi = {
  id: OperationsPhaseView;
  label: string;
  href: string;
  state: "done" | "current" | "pending";
};

function viewOrder(): OperationsPhaseView[] {
  return ["participants", "roster", "bracket-build", "bracket", "results"];
}

/** 단계별 ‘완료’ 기준 (현재 스키마 기준 이정표) */
function stepDone(
  index: number,
  snapshot: TournamentOperationPhaseSnapshot
): boolean {
  const rosterLocked = snapshot.participantRosterLockedAt != null;
  const hasBracket =
    snapshot.finalMatchCount > 0 || snapshot.status === "BRACKET_GENERATED";
  const finished = snapshot.status === "FINISHED";

  if (index <= 1) return rosterLocked;
  if (index === 2) return hasBracket;
  /* 3 경기 진행 · 4 결과 확정 — 대회 종료 시까지 결과 단계는 같은 이정표로 둠 */
  if (index >= 3) return finished;
  return false;
}

export function buildOperationPhaseSteps(
  tournamentId: string,
  snapshot: TournamentOperationPhaseSnapshot,
  current: OperationsPhaseView
): OperationPhaseStepUi[] {
  const base = `/client/operations/tournaments/${tournamentId}`;
  const order = viewOrder();
  const curIdx = order.indexOf(current);

  const steps: Omit<OperationPhaseStepUi, "state">[] = [
    { id: "participants", label: "참가자 관리", href: `${base}/participants` },
    { id: "roster", label: "명단 확정", href: `${base}/participant-roster` },
    { id: "bracket-build", label: "대진 생성", href: `${base}/bracket-build` },
    { id: "bracket", label: "경기 진행", href: `${base}/bracket` },
    { id: "results", label: "결과 확정", href: `/client/tournaments/${tournamentId}/results` },
  ];

  return steps.map((s, i) => {
    let state: OperationPhaseStepUi["state"];
    if (i === curIdx) {
      state = "current";
    } else if (stepDone(i, snapshot)) {
      state = "done";
    } else {
      state = "pending";
    }
    return { ...s, state };
  });
}
