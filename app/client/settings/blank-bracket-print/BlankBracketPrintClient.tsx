"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { buildBracketScene } from "./bracket-render-engine";

// @page 여백 = 10mm → 출력 영역 = 277 × 190 mm
const MARGIN_MM = 10;

const ROUND_LABEL: Record<number, string> = {
  128: "128강", 64: "64강", 32: "32강", 16: "16강",
  8: "8강", 4: "4강", 2: "결승",
};
const roundLabel = (n: number) => ROUND_LABEL[n] ?? `${n}강`;
const START_SIZES = [16, 32, 64, 128] as const;

function validEndOptions(start: number): number[] {
  return [128, 64, 32, 16, 8, 4, 2].filter(e => e < start);
}
function segmentRounds(start: number, end: number): number[] {
  const out: number[] = [];
  for (let n = start; n >= end; n = n / 2) out.push(n);
  if (end === 2 && out[out.length - 1] === 2) out.push(1);
  return out;
}

type MatchType    = "NORMAL" | "SCOTCH";
type BracketStyle = "TREE" | "CENTER";
type TreeLayout   = "HORIZONTAL" | "VERTICAL";

export default function BlankBracketPrintClient() {
  const [matchType,    setMatchType]    = useState<MatchType>("NORMAL");
  const [startPlayers, setStartPlayers] = useState(32);
  const [endPlayers,   setEndPlayers]   = useState(2);   /* 결승 */
  const [style,        setStyle]        = useState<BracketStyle>("TREE");
  const [treeLayout,   setTreeLayout]   = useState<TreeLayout>("VERTICAL");
  const [pdfExporting, setPdfExporting] = useState(false);
  const pdfRootRef = useRef<HTMLDivElement>(null);
  const pdfBusyRef = useRef(false);

  const endOptions = useMemo(() => validEndOptions(startPlayers), [startPlayers]);
  const rounds = useMemo(() => {
    if (!endOptions.includes(endPlayers)) return [];
    return segmentRounds(startPlayers, endPlayers);
  }, [startPlayers, endPlayers, endOptions]);

  const onStartChange = useCallback((n: number) => {
    setStartPlayers(n);
    setEndPlayers(prev => {
      const opts = validEndOptions(n);
      return opts.includes(prev) ? prev : (opts[opts.length - 1] ?? 2);
    });
  }, []);

  const scene = useMemo(() => {
    if (!rounds.length) return null;
    return buildBracketScene({ rounds, style, treeLayout });
  }, [rounds, style, treeLayout]);

  /** 새 창에 277×190mm 대진표만 표시 — 사용자가 Ctrl+P 등으로 인쇄 */
  const handleOpenPreviewWindow = useCallback(() => {
    if (!rounds.length || !scene) return;
    const open = () => {
      const root = pdfRootRef.current;
      if (!root) return;
      const inner = root.innerHTML;
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) {
        alert("팝업이 차단되었습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.");
        return;
      }
      w.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>빈 대진표 미리보기</title>
<style>
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  body { display: flex; flex-direction: column; align-items: center; padding: 16px; box-sizing: border-box; min-height: 100vh; font-family: system-ui, "Segoe UI", sans-serif; }
  .sheet {
    background: #fff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
    box-sizing: border-box;
    width: 297mm;
    min-height: 210mm;
    padding: 10mm;
  }
  .hint { margin-top: 12px; font-size: 13px; color: #64748b; text-align: center; max-width: 40rem; }
  @media print {
    html, body { background: #fff; }
    body { padding: 0; display: block; }
    .sheet { box-shadow: none; width: auto; min-height: auto; padding: 0; }
    .hint { display: none; }
    @page { size: A4 landscape; margin: ${MARGIN_MM}mm; }
  }
</style>
</head>
<body>
  <div class="sheet">${inner}</div>
  <p class="hint">인쇄는 브라우저 메뉴의 인쇄(Ctrl+P)를 사용하세요.</p>
</body>
</html>`);
      w.document.close();
      w.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(open));
  }, [rounds.length, scene]);

  /** A4 가로 PDF — html2canvas 로 `.bbp-print-svg` 캡처 후 jsPDF 에 277×190mm 로 삽입 */
  const handleExportPDF = useCallback(async () => {
    if (pdfBusyRef.current) return;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const root = pdfRootRef.current;
    if (!root) return;

    pdfBusyRef.current = true;
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(root, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      pdf.addImage(imgData, "PNG", MARGIN_MM, MARGIN_MM, 277, 190);
      pdf.save(`bracket_${startPlayers}강.pdf`);
    } finally {
      pdfBusyRef.current = false;
      setPdfExporting(false);
    }
  }, [startPlayers]);

  return (
    <>
      {/* html2canvas 캡처용 오프스크린 SVG — 본 페이지에서는 인쇄하지 않음 */}
      <style>{`
        @media screen {
          .bbp-print-svg {
            position: fixed;
            left: -10000px;
            top: 0;
            width: 277mm;
            height: 190mm;
            overflow: hidden;
            z-index: -1;
            pointer-events: none;
          }
        }
      `}</style>

      {/* ── 설정 패널 ── */}
      <div className="bbp-no-print"
        style={{ maxWidth: "min(100%,56rem)", margin: "0 auto", padding: "0 0.75rem 1.5rem" }}>
        <main className="v3-page v3-stack" style={{ gap: "1rem" }}>
          <div className="v3-row"
            style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem" }}>
              <Link className="v3-btn" href="/client/settings" style={{ padding: "0.5rem 0.9rem" }}>← 부가기능</Link>
              <h1 className="v3-h1" style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>빈 대진표 출력</h1>
            </div>
          </div>

          <section className="v3-box v3-stack"
            style={{ gap: 0, border: "1px solid #d1d5db", borderRadius: "8px", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1rem 0.75rem", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>설정</h2>
            </div>
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* 경기 유형 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>1. 경기 유형</span>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                  {(["NORMAL", "SCOTCH"] as MatchType[]).map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                      <input type="radio" name="mt" checked={matchType === t} onChange={() => setMatchType(t)} />
                      {t === "NORMAL" ? "일반" : "스카치(2인 1조)"}
                    </label>
                  ))}
                </div>
              </div>
              {/* 강수 */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>2. 시작 강수</span>
                  <select value={startPlayers} onChange={e => onStartChange(Number(e.target.value))}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {START_SIZES.map(s => <option key={s} value={s}>{roundLabel(s)}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>3. 종료 강수</span>
                  <select value={endPlayers} onChange={e => setEndPlayers(Number(e.target.value))}
                    style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {endOptions.map(e => <option key={e} value={e}>{roundLabel(e)}</option>)}
                  </select>
                </label>
              </div>
              {/* 스타일 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>4. 스타일</span>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                  {(["TREE", "CENTER"] as BracketStyle[]).map(s => (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                      <input type="radio" name="st" checked={style === s} onChange={() => setStyle(s)} />
                      {s === "TREE" ? "트리형" : "양쪽→중앙"}
                    </label>
                  ))}
                </div>
                {style === "TREE" && (
                  <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                    {(["HORIZONTAL", "VERTICAL"] as TreeLayout[]).map(l => (
                      <label key={l} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "40px" }}>
                        <input type="radio" name="tl" checked={treeLayout === l} onChange={() => setTreeLayout(l)} />
                        {l === "HORIZONTAL" ? "가로형 (좌→우)" : "세로형 (아래→위)"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={handleOpenPreviewWindow}
                disabled={!rounds.length || !scene}
                style={{ padding: "0.55rem 1rem", minHeight: "44px" }}
              >
                미리보기
              </button>
              <button
                type="button"
                className="ui-btn-primary-solid"
                disabled={!rounds.length || !scene || pdfExporting}
                onClick={() => void handleExportPDF()}
                style={{ padding: "0.55rem 1rem", minHeight: "44px" }}
              >
                {pdfExporting ? "PDF…" : "PDF"}
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* html2canvas·새창 미리보기 공용: 277×190mm SVG (화면 밖) */}
      {scene && (
        <div ref={pdfRootRef} className="bbp-print-svg" id="bbp-print-svg-root">
          <BracketSVG scene={scene} matchType={matchType} />
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketSVG
// viewBox="0 0 277 190" → 좌표 단위 = mm
// style 에 width/height/min-width/min-height 를 모두 인라인으로 강제해서
// 프로젝트 전역 CSS (svg { max-width:100% } 등) 에 눌리지 않게 한다.
// ─────────────────────────────────────────────────────────────────────────────
function BracketSVG({
  scene,
  matchType,
}: {
  scene: {
    boxes: { x: number; y: number; w: number; h: number }[];
    lines: { x1: number; y1: number; x2: number; y2: number }[];
  };
  matchType: MatchType;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 277 190"
      style={{
        /* 절대 크기 강제 — 어떤 상위 CSS 도 이길 수 없음 */
        display:   "block",
        width:     "277mm",
        height:    "190mm",
        minWidth:  "277mm",
        minHeight: "190mm",
        maxWidth:  "none",
        maxHeight: "none",
        /* 배경 흰색 */
        background: "#ffffff",
      }}
    >
      {/* 경로선 (박스보다 먼저 그려 박스 테두리가 위로 올라옴) */}
      {scene.lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1}
          x2={l.x2} y2={l.y2}
          stroke="#000000"
          strokeWidth={0.2}
          strokeLinecap="square"
        />
      ))}

      {/* 박스 */}
      {scene.boxes.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x} y={b.y}
            width={b.w} height={b.h}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={0.2}
          />
          {matchType === "SCOTCH" && (
            <line
              x1={b.x + b.w / 2}  y1={b.y}
              x2={b.x + b.w / 2}  y2={b.y + b.h}
              stroke="#000000" strokeWidth={0.2}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
