"use client";

import { BracketPrintClientShell } from "../../../settings/blank-bracket-print/BracketPrintClientShell";

export default function TournamentGroupRound1PrintClient({
  tournamentId,
  printStartPlayersHint = null,
}: {
  tournamentId: string;
  /** 확정 대진표·현재 조 선택 기준 시작 강수 자동값 */
  printStartPlayersHint?: number | null;
}) {
  return (
    <BracketPrintClientShell
      variant="tournament"
      tournamentId={tournamentId}
      embedded
      printStartPlayersHint={printStartPlayersHint}
    />
  );
}
