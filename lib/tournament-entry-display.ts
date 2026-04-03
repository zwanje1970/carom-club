export type TournamentEntryDisplaySource = {
  displayName?: string | null;
  playerAName?: string | null;
  playerBName?: string | null;
  user?: { name?: string | null } | null;
  slotNumber?: number | null;
  isScotch?: boolean | null;
};

function joinTeamName(playerA: string | null | undefined, playerB: string | null | undefined): string | null {
  const a = playerA?.trim() ?? "";
  const b = playerB?.trim() ?? "";
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return `${a} / ${b}`;
}

export function formatTournamentEntryDisplayName(entry: TournamentEntryDisplaySource): string {
  const teamName = entry.isScotch ? joinTeamName(entry.playerAName, entry.playerBName) : null;
  if (teamName) return teamName;

  const explicit = entry.displayName?.trim();
  if (explicit) return explicit;

  const userName = entry.user?.name?.trim();
  if (!userName) return "";
  const slotNumber = entry.slotNumber ?? 1;
  return slotNumber > 1 ? `${userName} (슬롯${slotNumber})` : userName;
}
