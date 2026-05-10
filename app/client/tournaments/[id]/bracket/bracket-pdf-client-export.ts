"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";

import BracketBoardPdfCanvas from "./BracketBoardPdfCanvas";
import type { BoardBracket } from "./bracket-board-layout";

/** jsPDF 삽입 폭·높이(mm) — BracketPrintClientShell 과 동일 */
const BRACKET_PDF_CONTENT_W_MM = 277;
const BRACKET_PDF_CONTENT_H_MM = 190;
const MARGIN_MM = 10;

export type BracketBoardPdfSnapshot = {
  bracket: BoardBracket & { id?: string };
  boardViewMode: "vertical" | "horizontal" | "dual";
  /** 화면과 동일한 미저장 승자 선택 등 — 서버 winnerUserId 와 병합 시 스냅샷이 우선 */
  winnerByPairSnapshot: Record<string, 0 | 1>;
};

function formatPdfDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * 기존 html2canvas → jsPDF(A4 가로) 흐름. DOM은 일회성으로만 마운트한다.
 */
export async function exportCurrentBracketToPdf(
  snap: BracketBoardPdfSnapshot & { fileNameBase: string },
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const host = document.createElement("div");
  host.setAttribute("data-bracket-pdf-export-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-14000px",
    "top:0",
    `width:${BRACKET_PDF_CONTENT_W_MM}mm`,
    `height:${BRACKET_PDF_CONTENT_H_MM}mm`,
    "overflow:hidden",
    "background:#ffffff",
    "z-index:-1",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");

  document.body.appendChild(host);

  const reactRoot = createRoot(host);
  reactRoot.render(
    createElement(BracketBoardPdfCanvas, {
      pdfFitSheet: true,
      bracket: snap.bracket,
      boardViewMode: snap.boardViewMode,
      matchType: "NORMAL",
      winnerByPairSnapshot: snap.winnerByPairSnapshot,
    }),
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    const canvas = await html2canvas(host, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "PNG", MARGIN_MM, MARGIN_MM, BRACKET_PDF_CONTENT_W_MM, BRACKET_PDF_CONTENT_H_MM);
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeBase = snap.fileNameBase.replace(/[^\w\-가-힣]+/g, "_").slice(0, 80);
    a.href = url;
    a.download = `${safeBase}_${formatPdfDate(new Date())}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 400);
  } finally {
    reactRoot.unmount();
    host.remove();
  }
}
