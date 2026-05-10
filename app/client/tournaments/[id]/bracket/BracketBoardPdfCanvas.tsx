"use client";

import { useMemo } from "react";
import {
  calculateLayout,
  computeBracketBoardMetrics,
  layoutDualFromVerticalBase,
  layoutHorizontalFromVerticalBase,
  type BoardBracket,
  type BracketLayoutCalculation,
} from "./bracket-board-layout";
import printStyles from "./bracket-board-print-theme.module.css";
import {
  cloneBracketBoardForPrintLayout,
  computeBracketPrintDerived,
  winnerByPairFromBracketServer,
  type BracketBoardPrintInput,
} from "./bracket-board-print-derived";
import BracketPdfScaledSheet from "./BracketPdfScaledSheet";

export type MatchTypePdf = "NORMAL" | "SCOTCH";

export type BracketBoardPdfCanvasProps = {
  bracket: BoardBracket & { id?: string };
  boardViewMode: "vertical" | "horizontal" | "dual";
  matchType?: MatchTypePdf;
  warmEmptyBoxFill?: boolean;
  showStartPairNumbers?: boolean;
  /** 빈 대진표: 레이아웃은 유지하고 표시 이름만 제거 */
  blankAllNames?: boolean;
  /** true: 부모(277×190mm) 안에 자동 scale 로 맞춤 */
  pdfFitSheet?: boolean;
  /** InteractiveBracketBoard 로컬 승자 선택 등 — 서버 값 위에 덮어씀 */
  winnerByPairSnapshot?: Record<string, 0 | 1> | null;
};

export default function BracketBoardPdfCanvas({
  bracket,
  boardViewMode,
  matchType = "NORMAL",
  warmEmptyBoxFill = false,
  showStartPairNumbers = false,
  blankAllNames = false,
  pdfFitSheet = false,
  winnerByPairSnapshot = null,
}: BracketBoardPdfCanvasProps) {
  const bracketForLayout = useMemo(() => cloneBracketBoardForPrintLayout(bracket as BracketBoardPrintInput), [bracket]);

  const metrics = useMemo(
    () => computeBracketBoardMetrics(bracketForLayout as BoardBracket, "vertical"),
    [bracketForLayout],
  );

  const layoutVerticalBase = useMemo(
    () => calculateLayout(bracketForLayout as BoardBracket, metrics, "vertical"),
    [bracketForLayout, metrics],
  );

  const layoutComputed = useMemo((): BracketLayoutCalculation => {
    if (boardViewMode === "vertical") return layoutVerticalBase;
    if (boardViewMode === "horizontal") return layoutHorizontalFromVerticalBase(layoutVerticalBase, metrics);
    return layoutDualFromVerticalBase(layoutVerticalBase, metrics);
  }, [layoutVerticalBase, metrics, boardViewMode]);

  const canvasWidth = layoutComputed.canvasBounds?.width ?? metrics.canvasWidth;
  const canvasHeight = layoutComputed.canvasBounds?.height ?? metrics.canvasHeight;

  const winnerByPair = useMemo(() => {
    const fromServer = winnerByPairFromBracketServer(bracketForLayout as BracketBoardPrintInput);
    return { ...fromServer, ...(winnerByPairSnapshot ?? {}) };
  }, [bracketForLayout, winnerByPairSnapshot]);

  const derived = useMemo(
    () => computeBracketPrintDerived(bracketForLayout as BracketBoardPrintInput, layoutComputed, winnerByPair),
    [bracketForLayout, layoutComputed, winnerByPair],
  );

  const startPairOverlay = useMemo(() => {
    if (!showStartPairNumbers) return [];
    const row0 = layoutComputed.positionedMatches
      .filter((p) => p.roundIndex === 0)
      .sort((a, b) => a.internalIndex - b.internalIndex);
    if (row0.length < 2) return [];
    const out: Array<{ key: string; left: number; top: number; transform?: string; text: string }> = [];

    const pushPair = (a: (typeof row0)[number], b: (typeof row0)[number], side: "left" | "right", gn: number) => {
      const midY = (a.frame.y + a.frame.height / 2 + b.frame.y + b.frame.height / 2) / 2;
      if (boardViewMode === "vertical") {
        const midX = (a.frame.x + a.frame.width / 2 + b.frame.x + b.frame.width / 2) / 2;
        const topY = Math.min(a.frame.y, b.frame.y);
        out.push({
          key: `sp-${side}-${gn}`,
          left: midX,
          top: topY - 16,
          transform: "translateX(-50%)",
          text: String(gn),
        });
        return;
      }
      if (boardViewMode === "horizontal") {
        out.push({
          key: `sp-h-${gn}`,
          left: Math.min(a.frame.x, b.frame.x) - 20,
          top: midY - 6,
          text: String(gn),
        });
        return;
      }
      /* dual */
      const outwardLeft = side === "left";
      out.push({
        key: `sp-d-${side}-${gn}`,
        left: outwardLeft ? Math.min(a.frame.x, b.frame.x) - 20 : Math.max(a.frame.x + a.frame.width, b.frame.x + b.frame.width) + 8,
        top: midY - 6,
        text: String(gn),
      });
    };

    if (boardViewMode === "dual") {
      const halfLeaves = row0.length / 2;
      const pairsPerSide = halfLeaves / 2;
      let gn = 1;
      for (let k = 0; k < pairsPerSide; k++) {
        const a = row0[2 * k];
        const b = row0[2 * k + 1];
        if (a && b) pushPair(a, b, "left", gn++);
      }
      for (let k = 0; k < pairsPerSide; k++) {
        const a = row0[halfLeaves + 2 * k];
        const b = row0[halfLeaves + 2 * k + 1];
        if (a && b) pushPair(a, b, "right", gn++);
      }
      return out;
    }

    let gn = 1;
    for (let k = 0; k < row0.length / 2; k++) {
      const a = row0[2 * k];
      const b = row0[2 * k + 1];
      if (!a || !b) continue;
      pushPair(a, b, "left", gn++);
    }
    return out;
  }, [layoutComputed.positionedMatches, showStartPairNumbers, boardViewMode]);

  const isConnActive = (connectorKey: string, segmentIndex: number): boolean => {
    const keys = derived.activeConnectorKeys;
    if (!connectorKey.includes("+")) {
      return keys.has(connectorKey);
    }
    const [leftPart, rightPart] = connectorKey.split("+");
    const [rightSlotPart, parentPart] = (rightPart ?? "").split("->");
    if (!leftPart || !rightSlotPart || !parentPart) return false;
    if (segmentIndex === 0) return keys.has(`pair:${leftPart}`);
    if (segmentIndex === 1) return keys.has(`pair:${rightSlotPart}`);
    return keys.has(`${leftPart}+${rightSlotPart}->${parentPart}`);
  };

  const inner = (
    <div className={printStyles.sheetRoot} style={{ width: canvasWidth, height: canvasHeight }}>
      <div className={printStyles.canvasRoot} style={{ width: canvasWidth, height: canvasHeight }}>
        <svg className={printStyles.linkSvg} width={canvasWidth} height={canvasHeight} aria-hidden>
          {layoutComputed.connectors.map((connector) => (
            <g key={connector.key}>
              {connector.basePaths.map((d, idx) => {
                const active = isConnActive(connector.key, idx);
                return (
                  <path
                    key={`${connector.key}:${idx}`}
                    d={d}
                    className={`${printStyles.pathBase} ${active ? printStyles.pathActive : ""}`}
                  />
                );
              })}
            </g>
          ))}
        </svg>

        {startPairOverlay.map((t) => (
          <div
            key={t.key}
            className={printStyles.startPairLabel}
            style={{
              left: t.left,
              top: t.top,
              transform: t.transform,
            }}
          >
            {t.text}
          </div>
        ))}

        {layoutComputed.positionedMatches.map((item) => {
          const slotLabelRaw = derived.labelByItemKey.get(item.key) ?? "";
          const slotLabel = blankAllNames ? "" : slotLabelRaw;
          const slotWinner = derived.winnerByItemKey.get(item.key) === true;
          const slotLoser = derived.loserByItemKey.get(item.key) === true;
          const emptyVisual = !slotLabel.trim();
          return (
            <div
              key={item.key}
              className={printStyles.matchGroup}
              style={{
                left: item.frame.x,
                top: item.frame.y,
                width: item.frame.width,
              }}
            >
              <div
                className={[
                  printStyles.playerBox,
                  emptyVisual && warmEmptyBoxFill ? printStyles.playerBoxWarmEmpty : "",
                  slotWinner && !slotLoser ? printStyles.playerWinner : "",
                  slotLoser ? printStyles.playerLoser : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ width: item.frame.width, height: item.frame.height, position: "relative" }}
              >
                {slotLabel || "\u00a0"}
                {matchType === "SCOTCH" ? <span className={printStyles.scotchDivider} aria-hidden /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (pdfFitSheet) {
    return (
      <BracketPdfScaledSheet contentWidthPx={canvasWidth} contentHeightPx={canvasHeight}>
        {inner}
      </BracketPdfScaledSheet>
    );
  }

  return inner;
}
