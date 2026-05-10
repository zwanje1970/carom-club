import type { BracketLayoutCalculation, PositionedBoardMatch } from "./bracket-board-layout";
import {
  isEligibleBracketWinnerUserId,
  isPropagatableBracketWinnerLabel,
} from "./bracket-view-server-sync";

type BoardPlayerSlot = {
  userId: string;
  name: string;
  displayName?: string | null;
};

type BoardRoundLike = {
  roundNumber: number;
  matches: Array<{
    id: string;
    player1: BoardPlayerSlot;
    player2: BoardPlayerSlot;
    winnerUserId: string | null;
  }>;
};

export type BracketBoardPrintInput = {
  rounds: BoardRoundLike[];
};

type WinnerChoice = 0 | 1;

function bracketSlotLabel(p: { name: string; displayName?: string | null }): string {
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  return d || p.name;
}

function readRawSlotPlayer(
  bracketInput: BracketBoardPrintInput,
  roundIndex: number,
  internalIndex: number,
): BoardPlayerSlot | null {
  const round = bracketInput.rounds[roundIndex];
  const match = round?.matches[Math.floor(internalIndex / 2)];
  if (!match) return null;
  return (internalIndex % 2 === 0 ? match.player1 : match.player2) as BoardPlayerSlot;
}

function slotUserIdForHighlight(raw: BoardPlayerSlot | null): string {
  if (!raw) return "";
  const id = typeof raw.userId === "string" ? raw.userId.trim() : "";
  if (!id || id === "__none" || id.startsWith("__TBD__")) return "";
  return id;
}

function opponentSlotLooksFilled(raw: BoardPlayerSlot | null): boolean {
  if (!raw) return false;
  if (slotUserIdForHighlight(raw)) return true;
  const name = (raw.name ?? "").trim();
  return name !== "" && name !== "대기";
}

/** 서버 대진표의 승자만 반영(화면과 동일 규칙의 스냅샷용 — 로컬 미저장 픽 없음) */
export function winnerByPairFromBracketServer(bracket: BracketBoardPrintInput): Record<string, WinnerChoice> {
  const out: Record<string, WinnerChoice> = {};
  for (let ri = 0; ri < bracket.rounds.length; ri++) {
    const matches = bracket.rounds[ri]?.matches ?? [];
    for (let j = 0; j < matches.length; j++) {
      const m = matches[j];
      const w = m.winnerUserId?.trim() ?? "";
      if (!w) continue;
      const p1 = m.player1.userId.trim();
      const p2 = m.player2.userId.trim();
      if (w === p1) out[`${ri}:${j}`] = 0;
      else if (w === p2) out[`${ri}:${j}`] = 1;
    }
  }
  return out;
}

export type BracketPrintDerived = {
  labelByItemKey: Map<string, string>;
  winnerByItemKey: Map<string, boolean>;
  loserByItemKey: Map<string, boolean>;
  opponentHasNameByItemKey: Map<string, boolean>;
  activeConnectorKeys: Set<string>;
};

/** InteractiveBracketBoard 의 derived 와 동일 로직(정적 인쇄용, winnerByPair 고정 입력) */
export function computeBracketPrintDerived(
  bracket: BracketBoardPrintInput,
  activeLayout: BracketLayoutCalculation,
  winnerByPair: Record<string, WinnerChoice>,
): BracketPrintDerived {
  const roundMap = new Map<number, PositionedBoardMatch[]>();
  for (const item of activeLayout.positionedMatches) {
    const arr = roundMap.get(item.roundIndex) ?? [];
    arr.push(item);
    roundMap.set(item.roundIndex, arr);
  }
  for (const arr of roundMap.values()) {
    arr.sort((a, b) => a.internalIndex - b.internalIndex);
  }
  const maxRoundIndex = roundMap.size > 0 ? Math.max(...roundMap.keys()) : -1;
  const labelsByRound: string[][] = [];
  const activeConnectorKeys = new Set<string>();

  for (let r = 0; r <= maxRoundIndex; r += 1) {
    const row = roundMap.get(r) ?? [];
    const rowLabels = Array.from({ length: row.length }, (_, idx) => {
      const raw = row[idx]?.match.player1.name?.trim() ?? "";
      return raw === "대기" ? "" : raw;
    });
    labelsByRound[r] = rowLabels;
  }

  for (let r = 1; r <= maxRoundIndex; r += 1) {
    const parentRow = roundMap.get(r) ?? [];
    const childLabels = labelsByRound[r - 1] ?? [];
    const parentLabels = [...(labelsByRound[r] ?? Array.from({ length: parentRow.length }, () => ""))];
    for (let j = 0; j < parentRow.length; j += 1) {
      const a = childLabels[2 * j] ?? "";
      const b = childLabels[2 * j + 1] ?? "";
      const pairKey = `${r - 1}:${j}`;
      const selected = winnerByPair[pairKey];
      if (selected !== 0 && selected !== 1) continue;
      const choice = selected;
      const srcMatch = bracket.rounds[r - 1]?.matches[j];
      if (!srcMatch) continue;
      const chosenPlayer = choice === 0 ? srcMatch.player1 : srcMatch.player2;
      const chosenRealId = typeof chosenPlayer.userId === "string" ? chosenPlayer.userId.trim() : "";
      if (!isEligibleBracketWinnerUserId(chosenRealId)) continue;
      const chosenLabel = choice === 0 ? a : b;
      if (!isPropagatableBracketWinnerLabel(chosenLabel)) continue;
      parentLabels[j] = chosenLabel;
      const childRoundNo = r;
      const parentRoundNo = r + 1;
      activeConnectorKeys.add(`pair:${childRoundNo}:${2 * j + choice}`);
      activeConnectorKeys.add(`${childRoundNo}:${2 * j}+${childRoundNo}:${2 * j + 1}->${parentRoundNo}:${j}`);
    }
    labelsByRound[r] = parentLabels;
  }

  const labelByItemKey = new Map<string, string>();
  const winnerByItemKey = new Map<string, boolean>();
  const loserByItemKey = new Map<string, boolean>();
  const opponentHasNameByItemKey = new Map<string, boolean>();

  for (let r = 0; r <= maxRoundIndex; r += 1) {
    const row = roundMap.get(r) ?? [];
    const labels = labelsByRound[r] ?? [];
    const parentRoundExists = r + 1 <= maxRoundIndex;
    for (let s = 0; s < row.length; s += 1) {
      const item = row[s];
      if (!item) continue;
      const label = labels[s] ?? "";
      labelByItemKey.set(item.key, label);
      const pairIdx = Math.floor(s / 2);
      const pairBase = pairIdx * 2;
      const selfInPair = s - pairBase;
      const oppIdx = pairBase + (selfInPair === 0 ? 1 : 0);

      const selfRaw = readRawSlotPlayer(bracket, r, s);
      const oppRaw = readRawSlotPlayer(bracket, r, oppIdx);
      const parentRaw = parentRoundExists ? readRawSlotPlayer(bracket, r + 1, pairIdx) : null;

      const selfId = slotUserIdForHighlight(selfRaw);
      const oppId = slotUserIdForHighlight(oppRaw);
      const parentId = slotUserIdForHighlight(parentRaw);

      let isWinner = Boolean(selfId && parentId && selfId === parentId);
      let isLoser = Boolean(selfId && oppId && parentId && parentId === oppId && selfId !== parentId);

      const pairPickKey = `${r}:${pairIdx}`;
      const picked = winnerByPair[pairPickKey];
      const srcMatchForPick = bracket.rounds[r]?.matches[pairIdx];
      if (!parentId && srcMatchForPick && (picked === 0 || picked === 1) && selfId) {
        const chosenPlayer = picked === 0 ? srcMatchForPick.player1 : srcMatchForPick.player2;
        const chosenRealId = typeof chosenPlayer.userId === "string" ? chosenPlayer.userId.trim() : "";
        if (isEligibleBracketWinnerUserId(chosenRealId)) {
          if (picked === selfInPair && selfId === chosenRealId) {
            isWinner = true;
            isLoser = false;
          } else if (oppId) {
            isLoser = true;
            isWinner = false;
          }
        }
      }

      opponentHasNameByItemKey.set(item.key, opponentSlotLooksFilled(oppRaw));
      winnerByItemKey.set(item.key, isWinner);
      loserByItemKey.set(item.key, isLoser);
    }
  }

  return { labelByItemKey, winnerByItemKey, loserByItemKey, opponentHasNameByItemKey, activeConnectorKeys };
}

export function cloneBracketBoardForPrintLayout(b: BracketBoardPrintInput): BracketBoardPrintInput {
  return {
    rounds: b.rounds.map((r) => ({
      ...r,
      matches: r.matches.map((m) => ({
        ...m,
        player1: {
          ...m.player1,
          name: bracketSlotLabel(m.player1 as BoardPlayerSlot),
        },
        player2: {
          ...m.player2,
          name: bracketSlotLabel(m.player2 as BoardPlayerSlot),
        },
      })),
    })),
  };
}
