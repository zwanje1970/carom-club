"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

/** 시작 강수(해당 라운드 참가 인원 수) */
const START_SIZES = [16, 32, 64, 128] as const;

/** 종료: 결승 = 2명 */
const END_LABEL: Record<number, string> = {
  128: "128강",
  64: "64강",
  32: "32강",
  16: "16강",
  8: "8강",
  4: "4강",
  2: "결승",
};

/** 32강 기준: 첫 라운드 인접 경기 중심 간격(픽셀). 다음 라운드는 2배씩 증가 */
const BASE_STEP_PX = 40;
const MATCH_BOX_W = 104;
const COL_GAP = 36;
const LINE_W = 1.25;
/** 라운드 제목 아래 본문 영역 시작 오프셋 — SVG·박스 y 일치 */
const LABEL_TOP = 26;

type MatchType = "NORMAL" | "SCOTCH";
type BracketStyle = "TREE" | "CENTER";

function roundLabel(players: number): string {
  return END_LABEL[players] ?? `${players}강`;
}

/** 시작~종료 라운드(참가 인원 수) 열 — 종료 라운드까지 포함 */
function segmentRounds(startPlayers: number, endPlayers: number): number[] {
  const out: number[] = [];
  let n = startPlayers;
  while (n >= endPlayers) {
    out.push(n);
    n = n / 2;
  }
  return out;
}

function validEndOptions(startPlayers: number): number[] {
  const all = [128, 64, 32, 16, 8, 4, 2];
  return all.filter((e) => e < startPlayers);
}

/** 라운드 c에서 경기 중심 간격 = base * 2^c (32강 기준 base, 라운드마다 2배) */
function stepForColumn(c: number, basePx: number): number {
  return basePx * Math.pow(2, c);
}

function matchBoxHeight(matchType: MatchType): number {
  return matchType === "NORMAL" ? 46 : 88;
}

export default function BlankBracketPrintClient() {
  const [matchType, setMatchType] = useState<MatchType>("NORMAL");
  const [startPlayers, setStartPlayers] = useState<number>(64);
  const [endPlayers, setEndPlayers] = useState<number>(16);
  const [style, setStyle] = useState<BracketStyle>("TREE");
  const [generated, setGenerated] = useState(false);

  const endOptions = useMemo(() => validEndOptions(startPlayers), [startPlayers]);

  const rounds = useMemo(() => {
    if (!endOptions.includes(endPlayers)) return [];
    return segmentRounds(startPlayers, endPlayers);
  }, [startPlayers, endPlayers, endOptions]);

  const onStartChange = useCallback((n: number) => {
    setStartPlayers(n);
    setEndPlayers((prev) => {
      const opts = validEndOptions(n);
      return opts.includes(prev) ? prev : opts[opts.length - 1] ?? 2;
    });
  }, []);

  const preview = useCallback(() => {
    setGenerated(true);
  }, []);

  const print = useCallback(() => {
    if (!generated) setGenerated(true);
    requestAnimationFrame(() => {
      window.print();
    });
  }, [generated]);

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          #blank-bracket-print-root {
            margin: 0 !important;
            padding: 0 !important;
          }
          .bracket-preview-frame {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .bracket-preview-frame .bracket-scroll {
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            padding: 0 !important;
          }
        }
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
      `}</style>

      <div
        className="ui-client-dashboard no-print"
        style={{ maxWidth: "min(100%, 56rem)", margin: "0 auto", padding: "0 0.75rem 1.5rem" }}
      >
        <main className="v3-page v3-stack" style={{ gap: "1rem" }}>
          <div
            className="v3-row ui-client-dashboard-header"
            style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}
          >
            <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link className="v3-btn" href="/client/settings" style={{ padding: "0.5rem 0.9rem" }}>
                ← 부가기능
              </Link>
              <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
                빈 대진표 출력
              </h1>
            </div>
          </div>

          <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
            <strong>1. 설정</strong> → <strong>2. 미리보기 생성</strong> → <strong>3. 인쇄 / PDF 저장</strong>
            <span style={{ display: "block", marginTop: "0.35rem" }}>
              아래 미리보기는 인쇄물과 동일하게 보입니다. A4 가로 · 흰 바탕 · 검은 선만 인쇄됩니다.
            </span>
          </p>

          <section
            className="v3-box v3-stack"
            style={{
              gap: 0,
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: "auto",
            }}
            aria-label="설정"
          >
            <div style={{ padding: "1rem 1rem 0.75rem", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                설정
              </h2>
            </div>

            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="v3-stack" style={{ gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>1. 경기 유형</span>
                <div className="v3-row" style={{ gap: "1.25rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                    <input type="radio" name="mt" checked={matchType === "NORMAL"} onChange={() => setMatchType("NORMAL")} />
                    일반
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                    <input type="radio" name="mt" checked={matchType === "SCOTCH"} onChange={() => setMatchType("SCOTCH")} />
                    스카치(2인 1조)
                  </label>
                </div>
              </div>

              <div className="v3-row" style={{ gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>2. 시작 강수</span>
                  <select
                    value={startPlayers}
                    onChange={(e) => onStartChange(Number(e.target.value))}
                    style={{ padding: "0.5rem 0.5rem", minWidth: "100%", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    {START_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {roundLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 10rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>3. 종료 강수</span>
                  <select
                    value={endPlayers}
                    onChange={(e) => setEndPlayers(Number(e.target.value))}
                    style={{ padding: "0.5rem 0.5rem", minWidth: "100%", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    {endOptions.map((e) => (
                      <option key={e} value={e}>
                        {roundLabel(e)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="v3-stack" style={{ gap: "0.45rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>4. 스타일</span>
                <div className="v3-row" style={{ gap: "1.25rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                    <input type="radio" name="st" checked={style === "TREE"} onChange={() => setStyle("TREE")} />
                    트리형 (좌→우)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", minHeight: "44px" }}>
                    <input type="radio" name="st" checked={style === "CENTER"} onChange={() => setStyle("CENTER")} />
                    양쪽→중앙
                  </label>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                borderTop: "1px solid #e5e7eb",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>5. 출력</span>
              <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="v3-btn" onClick={preview} style={{ padding: "0.55rem 1rem", minHeight: "44px" }}>
                  미리보기 생성
                </button>
                <button type="button" className="ui-btn-primary-solid" onClick={print} style={{ padding: "0.55rem 1rem", minHeight: "44px" }}>
                  인쇄 / PDF 저장
                </button>
              </div>
            </div>
          </section>

          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            PDF는 인쇄 대화상자에서 &quot;PDF로 저장&quot;을 선택하세요.
          </p>
        </main>
      </div>

      <div className="bracket-preview-frame" style={{ marginTop: "0.5rem", maxWidth: "min(100%, 56rem)", marginLeft: "auto", marginRight: "auto", padding: "0 0.75rem" }}>
        <div
          className="no-print"
          style={{
            fontWeight: 700,
            fontSize: "0.95rem",
            marginBottom: "0.5rem",
            color: "#0f172a",
          }}
        >
          미리보기
        </div>
        <div
          className="bracket-scroll"
          style={{
            border: "2px solid #0f172a",
            borderRadius: "4px",
            background: "#fff",
            padding: "clamp(0.5rem, 2vw, 1rem)",
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
            maxHeight: "min(70vh, 900px)",
            boxSizing: "border-box",
          }}
        >
          <div id="blank-bracket-print-root">
            {generated && rounds.length > 0 ? (
              <PrintableBracket
                matchType={matchType}
                style={style}
                rounds={rounds}
                startPlayers={startPlayers}
                endPlayers={endPlayers}
              />
            ) : (
              <div style={{ padding: "2rem 1rem", color: "#64748b", fontSize: "0.95rem", textAlign: "center" }}>
                설정을 선택한 뒤 <strong>미리보기 생성</strong>을 누르면 여기에 대진표가 표시됩니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PrintableBracket({
  matchType,
  style,
  rounds,
  startPlayers,
  endPlayers,
}: {
  matchType: MatchType;
  style: BracketStyle;
  rounds: number[];
  startPlayers: number;
  endPlayers: number;
}) {
  const boxH = matchBoxHeight(matchType);
  const m0 = rounds[0] / 2;
  const basePx = Math.max(BASE_STEP_PX, boxH + 14);
  const totalH = m0 * basePx;

  return (
    <div
      className="print-bracket-wrap"
      style={{
        background: "#fff",
        color: "#000",
        fontFamily: "system-ui, 'Segoe UI', sans-serif",
        padding: "10mm",
        boxSizing: "border-box",
        minWidth: "min(100%, 100%)",
      }}
    >
      <header
        style={{
          borderBottom: "1.5px solid #000",
          marginBottom: "12px",
          paddingBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "13pt", fontWeight: 700 }}>빈 대진표 (운영용)</h2>
        <div style={{ fontSize: "9pt" }}>
          {matchType === "NORMAL" ? "일반" : "스카치(2인 1조)"} · {style === "TREE" ? "트리형" : "양쪽→중앙"} ·{" "}
          {roundLabel(startPlayers)} ~ {roundLabel(endPlayers)}
        </div>
      </header>

      {style === "TREE" ? (
        <TreeBracket rounds={rounds} matchType={matchType} totalH={totalH} boxH={boxH} basePx={basePx} />
      ) : (
        <CenterBracket rounds={rounds} matchType={matchType} totalH={totalH} boxH={boxH} basePx={basePx} />
      )}

      <footer
        style={{
          marginTop: "14px",
          fontSize: "8pt",
          borderTop: "1px solid #000",
          paddingTop: "6px",
        }}
      >
        카롬 클럽 클라이언트 · 빈 칸에 기입 · A4 가로
      </footer>
    </div>
  );
}

function MatchBox({ matchType, compact }: { matchType: MatchType; compact?: boolean }) {
  const lineStyle: CSSProperties = {
    borderBottom: "1px solid #000",
    minHeight: compact ? "1.05rem" : "1.2rem",
    marginBottom: "2px",
    marginTop: "1px",
  };

  const pad = compact ? "3px 5px" : "5px 7px";
  const w = compact ? "5.75rem" : "6.75rem";

  if (matchType === "NORMAL") {
    return (
      <div
        style={{
          border: "1px solid #000",
          borderRadius: "2px",
          padding: pad,
          background: "#fff",
          minWidth: w,
          boxSizing: "border-box",
          minHeight: compact ? "2.5rem" : "2.85rem",
        }}
      >
        <div style={lineStyle} />
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #000",
        borderRadius: "2px",
        padding: pad,
        background: "#fff",
        minWidth: compact ? "6.25rem" : "7.25rem",
        boxSizing: "border-box",
        minHeight: compact ? "4.5rem" : "5.25rem",
      }}
    >
      <div style={{ fontSize: "7.5pt", marginBottom: "2px", fontWeight: 600 }}>A조</div>
      <div style={lineStyle} />
      <div style={lineStyle} />
      <div style={{ fontSize: "7.5pt", margin: "4px 0 2px", fontWeight: 600 }}>B조</div>
      <div style={lineStyle} />
      <div style={lineStyle} />
    </div>
  );
}

/** 경기 중심 y (전체 브래킷 수직 중앙 기준으로 컨테이너 중앙 정렬) */
function centerY(j: number, step: number): number {
  return (j + 0.5) * step;
}

function TreeBracket({
  rounds,
  matchType,
  totalH,
  boxH,
  basePx,
}: {
  rounds: number[];
  matchType: MatchType;
  totalH: number;
  boxH: number;
  basePx: number;
}) {
  const numCols = rounds.length;
  const colW = MATCH_BOX_W + COL_GAP;
  const svgH = LABEL_TOP + totalH;

  const paths: string[] = [];
  for (let c = 0; c < numCols - 1; c++) {
    const stepC = stepForColumn(c, basePx);
    const stepN = stepForColumn(c + 1, basePx);
    const mc = rounds[c] / 2;
    for (let j = 0; j < mc; j++) {
      const p = Math.floor(j / 2);
      const y1 = LABEL_TOP + centerY(j, stepC);
      const y2 = LABEL_TOP + centerY(p, stepN);
      const xR = c * colW + MATCH_BOX_W;
      const xL = (c + 1) * colW;
      const xMid = (xR + xL) / 2;
      paths.push(`M ${xR} ${y1} L ${xMid} ${y1} L ${xMid} ${y2} L ${xL} ${y2}`);
    }
  }

  const svgW = numCols * colW;

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <div style={{ position: "relative", width: svgW, height: svgH, margin: "0 auto" }}>
        <svg
          width={svgW}
          height={svgH}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            display: "block",
          }}
          aria-hidden
        >
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#000" strokeWidth={LINE_W} strokeLinecap="square" strokeLinejoin="miter" />
          ))}
        </svg>

        {rounds.map((players, colIdx) => {
          const matches = players / 2;
          const step = stepForColumn(colIdx, basePx);
          return (
            <div
              key={`${players}-${colIdx}`}
              style={{
                position: "absolute",
                left: colIdx * colW,
                top: 0,
                width: colW,
                height: svgH,
              }}
            >
              <div
                style={{
                  fontSize: "9pt",
                  fontWeight: 700,
                  textAlign: "center",
                  height: LABEL_TOP,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: "2px",
                }}
              >
                {roundLabel(players)}
              </div>
              <div style={{ position: "absolute", left: 0, top: LABEL_TOP, width: MATCH_BOX_W, height: totalH }}>
                {Array.from({ length: matches }, (_, j) => {
                  const cy = centerY(j, step);
                  const top = cy - boxH / 2;
                  return (
                    <div
                      key={j}
                      style={{
                        position: "absolute",
                        left: 0,
                        width: MATCH_BOX_W,
                        top,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <MatchBox matchType={matchType} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function xBoxLeftCenter(c: number, j: number, mc: number, colW: number): number {
  const base = c * colW;
  if (j < mc / 2) return base + 6;
  return base + colW - MATCH_BOX_W - 6;
}

function xBoxRightCenter(c: number, j: number, mc: number, colW: number): number {
  return xBoxLeftCenter(c, j, mc, colW) + MATCH_BOX_W;
}

function CenterBracket({
  rounds,
  matchType,
  totalH,
  boxH,
  basePx,
}: {
  rounds: number[];
  matchType: MatchType;
  totalH: number;
  boxH: number;
  basePx: number;
}) {
  const numCols = rounds.length;
  const colW = MATCH_BOX_W + COL_GAP;
  const svgW = numCols * colW;
  const svgH = LABEL_TOP + totalH;

  const paths: string[] = [];
  for (let c = 0; c < numCols - 1; c++) {
    const stepC = stepForColumn(c, basePx);
    const stepN = stepForColumn(c + 1, basePx);
    const mc = rounds[c] / 2;
    const mn = rounds[c + 1] / 2;
    for (let j = 0; j < mc; j++) {
      const p = Math.floor(j / 2);
      const y1 = LABEL_TOP + centerY(j, stepC);
      const y2 = LABEL_TOP + centerY(p, stepN);
      const xR = xBoxRightCenter(c, j, mc, colW);
      const xL = xBoxLeftCenter(c + 1, p, mn, colW);
      const xMid = (xR + xL) / 2;
      paths.push(`M ${xR} ${y1} L ${xMid} ${y1} L ${xMid} ${y2} L ${xL} ${y2}`);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <p style={{ fontSize: "0.82rem", margin: "0 0 0.75rem", color: "#000", lineHeight: 1.45 }}>
        좌·우에서 중앙으로 모이는 형태입니다. 경기 간 세로 간격은 트리형과 동일(라운드마다 2배)합니다.
      </p>
      <div style={{ position: "relative", width: svgW, height: svgH, margin: "0 auto" }}>
        <svg width={svgW} height={svgH} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} aria-hidden>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#000" strokeWidth={LINE_W} strokeLinecap="square" strokeLinejoin="miter" />
          ))}
        </svg>

        {rounds.map((players, colIdx) => {
          const matches = players / 2;
          const step = stepForColumn(colIdx, basePx);
          const half = matches / 2;

          if (matches === 1) {
            const cy = centerY(0, step);
            const top = LABEL_TOP + cy - boxH / 2;
            return (
              <div
                key={`${players}-final`}
                style={{
                  position: "absolute",
                  left: colIdx * colW,
                  top: 0,
                  width: colW,
                  height: svgH,
                }}
              >
                <div
                  style={{
                    fontSize: "9pt",
                    fontWeight: 700,
                    textAlign: "center",
                    height: LABEL_TOP,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: "2px",
                  }}
                >
                  {roundLabel(players)}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: (colW - MATCH_BOX_W) / 2,
                    top,
                    width: MATCH_BOX_W,
                  }}
                >
                  <MatchBox matchType={matchType} />
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${players}-${colIdx}`}
              style={{
                position: "absolute",
                left: colIdx * colW,
                top: 0,
                width: colW,
                height: svgH,
              }}
            >
              <div
                style={{
                  fontSize: "8pt",
                  fontWeight: 700,
                  textAlign: "center",
                  height: LABEL_TOP,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: "2px",
                  lineHeight: 1.2,
                }}
              >
                <span>{roundLabel(players)}</span>
                <span style={{ fontWeight: 600, fontSize: "7.5pt" }}>좌 · 우</span>
              </div>
              <div style={{ position: "absolute", left: 0, top: LABEL_TOP, width: colW, height: totalH }}>
                {Array.from({ length: half }, (_, j) => {
                  const jj = j;
                  const cy = centerY(jj, step);
                  const top = cy - boxH / 2;
                  const left = xBoxLeftCenter(colIdx, jj, matches, colW) - colIdx * colW;
                  return (
                    <div
                      key={`L-${j}`}
                      style={{
                        position: "absolute",
                        left,
                        top,
                        width: MATCH_BOX_W,
                      }}
                    >
                      <MatchBox matchType={matchType} compact />
                    </div>
                  );
                })}
                {Array.from({ length: half }, (_, j) => {
                  const jj = j + half;
                  const cy = centerY(jj, step);
                  const top = cy - boxH / 2;
                  const left = xBoxLeftCenter(colIdx, jj, matches, colW) - colIdx * colW;
                  return (
                    <div
                      key={`R-${j}`}
                      style={{
                        position: "absolute",
                        left,
                        top,
                        width: MATCH_BOX_W,
                      }}
                    >
                      <MatchBox matchType={matchType} compact />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
