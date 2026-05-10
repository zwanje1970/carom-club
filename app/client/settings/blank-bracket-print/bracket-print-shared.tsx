export type MatchType = "NORMAL" | "SCOTCH";

/** A4 가로 본문 영역 — jsPDF addImage 및 캡처 루트와 동일 */
export const BRACKET_PDF_MARGIN_MM = 10;

/** 용지(277×190mm) 루트 기준 고정 — 트리 DOM·scale 레이어와 분리 */
export function BracketPrintServiceMark() {
  return (
    <div className="bbp-print-service-mark" aria-hidden="true">
      ⓒ CAROM.CLUB
    </div>
  );
}
