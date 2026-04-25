"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { buildBracketScene, buildStartPairLabels, type StartPairLabel } from "./bracket-render-engine";

/**
 * 실제 인쇄 용지: A4 가로. @page(또는 PDF 삽입) 여백 10mm 기준으로 본문에 쓸 수 있는 직사각형이
 * 277mm × 190mm — 이 크기가 대진 도면(SVG width/height, jsPDF addImage 폭·높이)과 일치한다.
 */
const MARGIN_MM = 10;
/** 대진표(277×190mm) 도면 기준 우상단 — 용지 @page 여백과 별개 */
const SERVICE_MARK_INSET_MM = 0.6;
/** © 표기만 5mm 위로(대진표 좌표·박스 크기 불변, 양쪽→중앙형과 겹침 완화) */
const SERVICE_MARK_TOP_MM = SERVICE_MARK_INSET_MM - 5;
/** 기존 2.8mm 대비 50% */
const SERVICE_MARK_FONT_MM = 1.4;

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

/**
 * 미리보기 용지 px — 모바일 화면 방향·viewport 비율과 무관.
 * 세로형(tree VERTICAL)은 대진 트리가 아래→위로 올라가는 형식일 뿐, 용지는 항상 가로(277×190mm 영역과 동일 비율).
 */
function previewPaperFromPrintSettings(
  _style: BracketStyle,
  _treeLayout: TreeLayout,
): { paperW: number; paperH: number } {
  return { paperW: 1123, paperH: 794 };
}

export default function BlankBracketPrintClient() {
  const [matchType,    setMatchType]    = useState<MatchType>("NORMAL");
  const [startPlayers, setStartPlayers] = useState(32);
  const [endPlayers,   setEndPlayers]   = useState(2);   /* 결승 */
  const [style,        setStyle]        = useState<BracketStyle>("TREE");
  const [treeLayout,   setTreeLayout]   = useState<TreeLayout>("VERTICAL");
  const [showStartPairNumbers, setShowStartPairNumbers] = useState(false);
  /** 빈 칸 배경만 연한색 — 외곽선(stroke)은 CSS에서 검정 고정 */
  const [warmEmptyBoxFill, setWarmEmptyBoxFill] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const pdfRootRef = useRef<HTMLDivElement>(null);
  const pdfBusyRef = useRef(false);
  const previewTopbarRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);

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

  const startPairLabels = useMemo((): StartPairLabel[] => {
    if (!scene || !rounds.length || !showStartPairNumbers) return [];
    return buildStartPairLabels(scene, { rounds, style, treeLayout });
  }, [scene, rounds, style, treeLayout, showStartPairNumbers]);

  const previewPaper = useMemo(() => previewPaperFromPrintSettings(style, treeLayout), [style, treeLayout]);

  const updatePreviewScale = useCallback(() => {
    const { paperW, paperH } = previewPaper;
    const stage = previewStageRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    let vw: number;
    let vh: number;
    if (stage) {
      const cs = getComputedStyle(stage);
      const pl = Number.parseFloat(cs.paddingLeft) || 0;
      const pr = Number.parseFloat(cs.paddingRight) || 0;
      const pt = Number.parseFloat(cs.paddingTop) || 0;
      const pb = Number.parseFloat(cs.paddingBottom) || 0;
      vw = stage.clientWidth - pl - pr;
      vh = stage.clientHeight - pt - pb;
    } else if (vv) {
      vw = vv.width;
      vh = vv.height;
    } else {
      vw = window.innerWidth;
      vh = window.innerHeight;
    }
    /* 용지는 항상 가로 고정. 화면 방향 변화에는 scale/배치만 재계산한다. */
    const fitW = paperW;
    const fitH = paperH;
    const fitScale = Math.min(vw / fitW, vh / fitH, 1);
    const mqLandscape = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(orientation: landscape)").matches
      : window.innerWidth > window.innerHeight;
    const innerLandscape = typeof window !== "undefined" ? window.innerWidth > window.innerHeight : false;
    const isLandscape = mqLandscape || innerLandscape;

    let s = fitScale;
    if (isLandscape) {
      const viewportShortSide = Math.min(vw, vh);
      const targetMinScale = (viewportShortSide * 0.9) / paperH;
      s = Math.max(fitScale, targetMinScale);
    }
    if (!(s > 0) || !Number.isFinite(s)) s = 0.1;
    setPreviewScale(s);
  }, [previewPaper]);

  useEffect(() => {
    if (!previewOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [previewOpen]);

  useLayoutEffect(() => {
    if (!previewOpen) return;
    updatePreviewScale();
  }, [previewOpen, previewPaper, updatePreviewScale]);

  useEffect(() => {
    if (!previewOpen) return;
    let orientTimer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      requestAnimationFrame(() => updatePreviewScale());
    };
    window.addEventListener("resize", run);
    const onOrientation = () => {
      if (orientTimer) clearTimeout(orientTimer);
      orientTimer = setTimeout(run, 150);
    };
    window.addEventListener("orientationchange", onOrientation);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", run);
    return () => {
      if (orientTimer) clearTimeout(orientTimer);
      window.removeEventListener("resize", run);
      window.removeEventListener("orientationchange", onOrientation);
      vv?.removeEventListener("resize", run);
    };
  }, [previewOpen, updatePreviewScale]);

  /** 페이지 내부 전용 레이어 미리보기: A4 한 장 전체 scale, 스크롤·스와이프 없음 */
  const handleOpenPreviewOverlay = useCallback(() => {
    if (!rounds.length || !scene) return;
    setPreviewScale(1);
    setPreviewOpen(true);
  }, [rounds.length, scene]);

  const handleClosePreviewOverlay = useCallback(() => {
    setPreviewOpen(false);
    setPreviewScale(1);
    const stage = previewStageRef.current;
    if (stage) {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    }
  }, []);

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
  }, [startPlayers, warmEmptyBoxFill]);

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
        .bbp-print-page-sheet {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .bbp-print-service-mark {
          position: absolute;
          top: ${SERVICE_MARK_TOP_MM}mm;
          right: ${SERVICE_MARK_INSET_MM}mm;
          z-index: 10;
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: ${SERVICE_MARK_FONT_MM}mm;
          font-weight: 300;
          line-height: 1.2;
          color: #888888;
          letter-spacing: 0.02em;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          .bbp-print-service-mark {
            position: absolute;
            top: ${SERVICE_MARK_TOP_MM}mm;
            right: ${SERVICE_MARK_INSET_MM}mm;
          }
        }
        /* 빈 대진표 칸: 테두리는 항상 검정 — 배경만 .bbp-match-box--fill 에서 변경 */
        .bbp-match-box {
          fill: #ffffff;
          stroke: #000000;
          stroke-width: 0.2;
        }
        .bbp-match-box--fill {
          fill: #fffbe6;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .preview-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          box-sizing: border-box;
          font-family: system-ui, "Segoe UI", sans-serif;
          background: #e5e7eb;
          overflow: hidden;
        }
        .preview-overlay .preview-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100dvh;
          max-height: 100dvh;
          background: #e5e7eb;
          overflow: hidden;
          box-sizing: border-box;
        }
        .preview-overlay .preview-topbar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px;
          box-sizing: border-box;
          background: #e5e7eb;
        }
        .preview-overlay .preview-close-button {
          min-height: 44px;
          padding: 0 18px;
          font-size: 1rem;
          font-weight: 700;
          border: none;
          border-radius: 10px;
          background: #f59e0b;
          color: #111827;
          cursor: pointer;
        }
        .preview-overlay .preview-stage {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          display: block;
          padding: 0 max(16px, env(safe-area-inset-left, 0px)) calc(env(safe-area-inset-bottom, 0px) + 16px) max(16px, env(safe-area-inset-right, 0px));
          box-sizing: border-box;
          touch-action: pan-x pan-y pinch-zoom;
          -webkit-overflow-scrolling: touch;
        }
        .preview-overlay .paper-frame-slot {
          width: max-content;
          height: max-content;
          min-width: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-sizing: border-box;
        }
        .preview-overlay .paper-frame {
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: top left;
          will-change: transform;
        }
        .preview-overlay .paper {
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(0,0,0,0.18);
          box-sizing: border-box;
          border-radius: 2px;
          padding: ${MARGIN_MM}mm;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .preview-overlay .bracket-scene {
          line-height: 0;
        }
      `}</style>

      {/* ── 설정 패널 ── */}
      <div className="bbp-no-print"
        style={{ maxWidth: "min(100%,56rem)", margin: "0 auto", padding: "0 0.75rem 1.5rem" }}>
        <main className="v3-page v3-stack" style={{ gap: "1rem" }}>
          <div className="v3-row"
            style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem" }}>
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
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                <input
                  type="checkbox"
                  checked={showStartPairNumbers}
                  onChange={(e) => setShowStartPairNumbers(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>조번호 표시</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                <input
                  type="checkbox"
                  checked={warmEmptyBoxFill}
                  onChange={(e) => setWarmEmptyBoxFill(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>빈 칸 배경색</span>
              </label>
            </div>
            <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={handleOpenPreviewOverlay}
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
          <div className="bbp-print-page-sheet">
            <BracketSVG
              scene={scene}
              matchType={matchType}
              startPairLabels={startPairLabels}
              warmEmptyBoxFill={warmEmptyBoxFill}
            />
            <BracketPrintServiceMark />
          </div>
        </div>
      )}

      {previewOpen && scene && typeof document !== "undefined"
        ? createPortal(
            <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="빈 대진표 미리보기">
              <div className="preview-root">
                <div className="preview-topbar" ref={previewTopbarRef}>
                  <button type="button" className="preview-close-button" onClick={handleClosePreviewOverlay}>
                    닫기
                  </button>
                </div>
                <div className="preview-stage" ref={previewStageRef}>
                  <div
                    className="paper-frame-slot"
                    style={{
                      width: previewPaper.paperW * previewScale,
                      height: previewPaper.paperH * previewScale,
                    }}
                  >
                    <div
                      className="paper-frame"
                      style={{
                        width: previewPaper.paperW,
                        height: previewPaper.paperH,
                        left: 0,
                        top: 0,
                        marginLeft: 0,
                        marginTop: 0,
                        transform: `scale(${previewScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                    <div
                      className="paper"
                      style={{ width: previewPaper.paperW, height: previewPaper.paperH }}
                    >
                      <div className="bracket-scene">
                        <div className="bbp-print-page-sheet">
                          <BracketSVG
                            scene={scene}
                            matchType={matchType}
                            startPairLabels={startPairLabels}
                            warmEmptyBoxFill={warmEmptyBoxFill}
                          />
                          <BracketPrintServiceMark />
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** 용지(277×190mm) 루트 기준 고정 — SVG·트리·scale 레이어와 분리 */
function BracketPrintServiceMark() {
  return (
    <div className="bbp-print-service-mark" aria-hidden="true">
      ⓒ CAROM.CLUB
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketSVG
// viewBox="0 0 277 190" → 좌표 단위 = mm. SVG 실물 크기는 여전히 277mm×190mm(A4 가로 인쇄영역).
// style 에 width/height/min-width/min-height 를 모두 인라인으로 강제해서
// 프로젝트 전역 CSS (svg { max-width:100% } 등) 에 눌리지 않게 한다.
// ─────────────────────────────────────────────────────────────────────────────
/** 조번호 SVG 텍스트 (기존 2.05mm 의 50%) */
const PAIR_LABEL_FONT_MM = 1.025;

/**
 * 경계 클리핑 보조: stroke(0.2mm)가 viewBox 가장자리에서 잘리며 PDF에서 끝선만 얇게 보이는 현상 완화.
 * SVG 캔버스(277×190mm)와 PDF 배치 폭·높이는 그대로 — 도면만 동일 뷰포트 안에서 미세 축소(수 sub-mm).
 */
const BRACKET_SVG_INSET_MM = 0.12;
const BRACKET_SVG_W = 277;
const BRACKET_SVG_H = 190;

function BracketSVG({
  scene,
  matchType,
  startPairLabels = [],
  warmEmptyBoxFill = false,
}: {
  scene: {
    boxes: { x: number; y: number; w: number; h: number }[];
    lines: { x1: number; y1: number; x2: number; y2: number }[];
  };
  matchType: MatchType;
  startPairLabels?: StartPairLabel[];
  warmEmptyBoxFill?: boolean;
}) {
  const cx = BRACKET_SVG_W / 2;
  const cy = BRACKET_SVG_H / 2;
  const sx = (BRACKET_SVG_W - 2 * BRACKET_SVG_INSET_MM) / BRACKET_SVG_W;
  const sy = (BRACKET_SVG_H - 2 * BRACKET_SVG_INSET_MM) / BRACKET_SVG_H;
  const bracketInsetTransform = `translate(${cx},${cy}) scale(${sx},${sy}) translate(${-cx},${-cy})`;

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
      <g transform={bracketInsetTransform}>
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
              className={warmEmptyBoxFill ? "bbp-match-box bbp-match-box--fill" : "bbp-match-box"}
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

        {startPairLabels.length > 0 ? (
          <g className="bbp-start-pair-labels" aria-hidden="true">
            {startPairLabels.map((t, i) => (
              <text
                key={`sp-${i}`}
                x={t.x}
                y={t.y}
                textAnchor={t.textAnchor}
                dominantBaseline="middle"
                fill="#8e8e8e"
                fontSize={`${PAIR_LABEL_FONT_MM}mm`}
                fontWeight={300}
                fontFamily='system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                style={{ paintOrder: "stroke fill", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
              >
                {t.text}
              </text>
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}
