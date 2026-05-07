import { normalizeTournamentStatusBadge } from "./platform-backing-store";

/** 참가자 확정(마감) 이후에만 클라이언트 대진표 초기 생성 API 허용 */
const CLIENT_BRACKET_CREATION_ALLOWED = new Set<string>(["마감", "진행중", "종료"]);

export function tournamentStatusAllowsClientBracketCreation(statusBadge: unknown): boolean {
  const b = normalizeTournamentStatusBadge(statusBadge);
  return CLIENT_BRACKET_CREATION_ALLOWED.has(b);
}

export const CLIENT_BRACKET_CREATION_STATUS_ERROR = "참가자 확정(마감) 이후에만 대진표를 생성할 수 있습니다.";
