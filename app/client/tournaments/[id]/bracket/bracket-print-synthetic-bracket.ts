import type { BoardBracket, BoardMatch, BoardRound } from "./bracket-board-layout";

/**
 * 인쇄용 단일 예선 트리: 1라운드만 채우고 expandBracketRoundsForTree 로 결승까지 확장.
 * blank 이면 이름은 빈 칸(표시는 BracketBoardPdfCanvas 에서 blankAllNames 로 덮음).
 */
export function buildPrintSyntheticBracket(
  startPlayers: number,
  slotDisplay: "blank" | { names: (string | null)[] },
): BoardBracket & { id: string } {
  const nMatch = Math.max(1, Math.floor(startPlayers / 2));
  const matches: BoardMatch[] = [];
  for (let i = 0; i < nMatch; i++) {
    const raw1 = slotDisplay === "blank" ? null : slotDisplay.names[2 * i];
    const raw2 = slotDisplay === "blank" ? null : slotDisplay.names[2 * i + 1];
    const n1 =
      slotDisplay === "blank"
        ? ""
        : typeof raw1 === "string" && raw1.trim()
          ? raw1.trim()
          : "";
    const n2 =
      slotDisplay === "blank"
        ? ""
        : typeof raw2 === "string" && raw2.trim()
          ? raw2.trim()
          : "";
    matches.push({
      id: `print-m1-${i}`,
      player1: { userId: `print-u-${2 * i}`, name: n1 },
      player2: { userId: `print-u-${2 * i + 1}`, name: n2 },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }
  const rounds: BoardRound[] = [{ roundNumber: 1, status: "PENDING", matches }];
  return { id: "print-synthetic", rounds };
}
