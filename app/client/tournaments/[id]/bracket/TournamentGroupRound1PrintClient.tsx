"use client";

import { BracketPrintClientShell } from "../../../settings/blank-bracket-print/BracketPrintClientShell";

export default function TournamentGroupRound1PrintClient({ tournamentId }: { tournamentId: string }) {
  return <BracketPrintClientShell variant="tournament" tournamentId={tournamentId} embedded />;
}
