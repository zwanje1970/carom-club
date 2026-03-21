"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BilliardTableEditor,
  type BilliardTableEditorHandle,
} from "@/components/billiard";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  getPlayfieldRect,
  hitTestBall,
  isInsidePlayfield,
  landscapeToPortraitNorm,
  normalizedToPixel,
  pixelToNormalized,
  portraitToLandscapeNorm,
  type BallColor,
  type CueBallType,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import { SolutionTableZoomShell } from "@/components/nangu/SolutionTableZoomShell";
import type { SolutionTablePanPointerPolicy } from "@/components/nangu/SolutionTableZoomShell";
import type { SolutionTableZoomContextValue } from "@/components/nangu/solution-table-zoom-context";
import { useBallPlacementFullscreen } from "./BallPlacementFullscreenContext";

function CloseXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export interface MobileBallPlacementFullscreenProps {
  initialRed?: { x: number; y: number };
  initialYellow?: { x: number; y: number };
  initialWhite?: { x: number; y: number };
  initialCueBall?: CueBallType;
  onSave: (payload: {
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
    cueBall: CueBallType;
    memo: string;
    getImageDataURL: () => string;
  }) => Promise<void>;
  onExitFullscreen?: () => void;
  /** true면 완료 시 router.back() 호출 안 함 (작성 화면 복귀용) */
  returnOnly?: boolean;
  /**
   * 노트 수정 등: 슬라이드 메뉴에 메모 입력 — 저장 시 payload.memo에 포함.
   * 미사용 시(작성 단계 공배치) memo는 빈 문자열로 전달.
   */
  includeMemoField?: boolean;
  initialMemo?: string;
}

function useTableOrientation() {
  const [orientation, setOrientation] = useState<TableOrientation>("landscape");
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setOrientation(mq.matches ? "portrait" : "landscape");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return orientation;
}

export function MobileBallPlacementFullscreen({
  initialRed,
  initialYellow,
  initialWhite,
  initialCueBall,
  onSave,
  onExitFullscreen,
  returnOnly = false,
  includeMemoField = false,
  initialMemo = "",
}: MobileBallPlacementFullscreenProps) {
  const router = useRouter();
  const editorRef = useRef<BilliardTableEditorHandle>(null);
  const fullscreen = useBallPlacementFullscreen();
  const [noteMemo, setNoteMemo] = useState(initialMemo);
  useEffect(() => {
    setNoteMemo(initialMemo);
  }, [initialMemo]);
  /** 공배치 시작 시 수구 선택 UI 없음 — 기본 흰공(또는 initial). 변경은 상단「수구」 */
  const [cueBall, setCueBall] = useState<CueBallType>(initialCueBall ?? "white");
  const [cuePickerOpen, setCuePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [drawStyle, setDrawStyle] = useState<"realistic" | "wireframe">("realistic");
  /** 수구 깜빡임(스팟) 표시 — 수구확인 버튼으로 ON/OFF */
  const [cueSpotOn, setCueSpotOn] = useState(true);
  /** 미세조정 UI 포털 타깃 — 뷰포트 중앙·고정 크기 */
  const [fineTuneOverlayRoot, setFineTuneOverlayRoot] = useState<HTMLDivElement | null>(null);
  const orientation = useTableOrientation();
  const [placementBar, setPlacementBar] = useState<{
    selectedBall: BallColor | null;
    x: number;
    y: number;
    showCrosshair: boolean;
  } | null>(null);
  const onPlacementBarInfo = useCallback(
    (info: {
      selectedBall: BallColor | null;
      x: number;
      y: number;
      showCrosshair: boolean;
    }) => {
      setPlacementBar(info);
    },
    []
  );

  const zoomCtxRef = useRef<SolutionTableZoomContextValue | null>(null);
  const cw = orientation === "portrait" ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH;
  const ch = orientation === "portrait" ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT;
  const playfieldRect = useMemo(() => getPlayfieldRect(cw, ch), [cw, ch]);
  /** 공 스냅샷·히트는 항상 landscape 정규화 기준 (BilliardTableEditor / 캔버스와 동일) */
  const landscapePlayfieldRect = useMemo(
    () => getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    []
  );
  /**
   * 줌 초점: 항상 플레이필드 중심만 사용.
   * 선택 공 좌표를 초점으로 두면 드래그할 때마다 focusCanvas가 바뀌어
   * 뷰가 공을 화면 중앙에 붙잡고 테이블만 밀리는 것처럼 보임.
   */
  const zoomFocus = useMemo(() => {
    const centerVn =
      orientation === "portrait"
        ? landscapeToPortraitNorm(0.5, 0.5)
        : { x: 0.5, y: 0.5 };
    const center = normalizedToPixel(centerVn.x, centerVn.y, playfieldRect);
    return { x: center.px, y: center.py };
  }, [orientation, playfieldRect]);

  const panPointerPolicy = useMemo((): SolutionTablePanPointerPolicy => {
    return {
      isEmptyForPan(clientX, clientY, target) {
        if (target instanceof Element) {
          if (target.closest("[data-solution-table-zoom-controls]")) return false;
          if (target.closest("[data-ball-placement-overlay-ui]")) return false;
          if (target.closest("[data-ball-placement-chrome]")) return false;
        }
        const z = zoomCtxRef.current;
        if (!z) return false;
        const cp = z.viewportClientToCanvasPx(clientX, clientY);
        if (!cp || !isInsidePlayfield(cp.x, cp.y, playfieldRect)) return false;
        const snap = editorRef.current?.getSnapshot();
        // ref 미부착 시 "빈 곳"으로 보지 않음 — 그렇지 않으면 줌>1에서 뷰 팬이 먼저 잡혀 공이 안 움직임
        if (!snap) return false;
        const vn = pixelToNormalized(cp.x, cp.y, playfieldRect);
        const vnLand =
          orientation === "portrait"
            ? portraitToLandscapeNorm(vn.x, vn.y)
            : { x: vn.x, y: vn.y };
        const { px: hitPx, py: hitPy } = normalizedToPixel(
          vnLand.x,
          vnLand.y,
          landscapePlayfieldRect
        );
        return (
          hitTestBall(
            hitPx,
            hitPy,
            snap.redBall,
            snap.yellowBall,
            snap.whiteBall,
            landscapePlayfieldRect,
            6
          ) == null
        );
      },
    };
  }, [playfieldRect, landscapePlayfieldRect, orientation]);

  useEffect(() => {
    if (!toolsDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsDrawerOpen]);

  useEffect(() => {
    fullscreen?.setFullscreen(true);
    return () => {
      fullscreen?.setFullscreen(false);
    };
  }, [fullscreen]);

  const handleComplete = async () => {
    if (!editorRef.current || saving) return;
    const imageData = editorRef.current.getDataURL(true, true);
    if (!imageData) {
      alert("공배치 이미지를 생성할 수 없습니다.");
      return;
    }
    try {
      sessionStorage.setItem("ballLayoutImage", imageData);
    } catch {
      // ignore
    }
    setSaving(true);
    try {
      const snapshot = editorRef.current.getSnapshot();
      const getImageDataURL = () => imageData;
      await onSave({
        ...snapshot,
        memo: includeMemoField ? noteMemo.trim() : "",
        getImageDataURL,
      });
      fullscreen?.setFullscreen(false);
      onExitFullscreen?.();
      if (!returnOnly) router.back();
    } catch {
      // 저장 실패 시 페이지 이동하지 않음
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    fullscreen?.setFullscreen(false);
    onExitFullscreen?.();
    if (!returnOnly) router.back();
  };

  const pickCue = (next: CueBallType) => {
    setCueBall(next);
    setCuePickerOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-site-bg"
      style={{ padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}
    >
      {/* 당구대 전체 영역 (세로 가득) + 줌/팬 — 프레임 위 플로팅 X·저장·슬라이드 메뉴 */}
      <div className="flex flex-1 min-h-0 w-full items-stretch justify-center p-2">
        <div className="relative flex h-full min-h-0 w-full max-w-2xl flex-col">
          {/* 반투명 배경 + 우측 슬라이딩 패널 */}
          <div
            data-ball-placement-chrome=""
            aria-hidden={!toolsDrawerOpen}
            className={`fixed inset-0 z-[195] bg-black/30 transition-opacity duration-300 ease-out ${
              toolsDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setToolsDrawerOpen(false)}
          />
          <aside
            data-ball-placement-chrome=""
            id="ball-placement-tools-drawer"
            aria-hidden={!toolsDrawerOpen}
            className={`fixed top-0 right-0 z-[200] flex h-full w-[min(88vw,300px)] flex-col border-l border-white/20 bg-black/30 text-white shadow-[-6px_0_20px_rgba(0,0,0,0.25)] backdrop-blur-md transition-transform duration-300 ease-out ${
              toolsDrawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
            <div className="border-b border-white/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <h2 className="text-sm font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">보기 · 설정</h2>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                onClick={() => {
                  setToolsDrawerOpen(false);
                  setCuePickerOpen(true);
                }}
              >
                수구 변경
                <span className="mt-0.5 block text-xs font-normal text-white/55">
                  현재: {cueBall === "yellow" ? "노란공" : "흰공"}
                </span>
              </button>
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                onClick={() => {
                  setDrawStyle(drawStyle === "realistic" ? "wireframe" : "realistic");
                  setToolsDrawerOpen(false);
                }}
              >
                {drawStyle === "realistic" ? "단순보기로 전환" : "실사보기로 전환"}
              </button>
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                onClick={() => {
                  setGridOn(!gridOn);
                  setToolsDrawerOpen(false);
                }}
              >
                {gridOn ? "그리드 숨기기" : "그리드 보이기"}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={cueSpotOn}
                className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                onClick={() => {
                  setCueSpotOn((v) => !v);
                  setToolsDrawerOpen(false);
                }}
              >
                수구 확인 표시
                <span className="mt-0.5 block text-xs font-normal text-white/55">
                  {cueSpotOn ? "켜짐 (ON)" : "꺼짐 (OFF)"}
                </span>
              </button>
              {includeMemoField ? (
                <div className="mt-2 border-t border-white/10 pt-3">
                  <label className="block text-xs font-medium text-white/80 mb-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    메모
                  </label>
                  <textarea
                    value={noteMemo}
                    onChange={(e) => setNoteMemo(e.target.value)}
                    placeholder="상황, 느낀 점 등"
                    rows={4}
                    className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
                  />
                </div>
              ) : null}
            </div>
          </aside>

          {/* 우측 가장자리 살짝 노출 탭 — 슬라이드 메뉴 열기 */}
          <button
            type="button"
            data-ball-placement-chrome=""
            aria-label="보기 및 설정 메뉴 열기"
            aria-expanded={toolsDrawerOpen}
            aria-controls="ball-placement-tools-drawer"
            onClick={() => setToolsDrawerOpen(true)}
            className="absolute right-0 top-1/2 z-[125] flex h-11 w-[1.35rem] -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-white/20 bg-black/30 text-white shadow-md backdrop-blur-sm touch-manipulation hover:bg-black/40 active:bg-black/45"
          >
            <svg className="h-3.5 w-3.5 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* 프레임 왼쪽 상단: 닫기 (원형 X) */}
          <button
            type="button"
            data-ball-placement-chrome=""
            onClick={handleCancel}
            className="absolute z-[125] flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/50 text-white shadow-lg backdrop-blur-md touch-manipulation hover:bg-black/60 active:scale-95"
            style={{ top: "max(0.5rem, env(safe-area-inset-top, 0px))", left: "max(0.5rem, env(safe-area-inset-left, 0px))" }}
            aria-label="닫기"
          >
            <CloseXIcon className="h-5 w-5" />
          </button>

          {/* 프레임 오른쪽 상단: 저장 */}
          <button
            type="button"
            data-ball-placement-chrome=""
            onClick={handleComplete}
            disabled={saving}
            className="absolute z-[125] rounded-full bg-site-primary px-4 py-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm touch-manipulation disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
            style={{ top: "max(0.5rem, env(safe-area-inset-top, 0px))", right: "max(0.5rem, env(safe-area-inset-right, 0px))" }}
            aria-label={saving ? "저장 중" : "저장"}
          >
            {saving ? "저장 중…" : "저장"}
          </button>

          {/* 선택된 공 표시 (중앙 상단) */}
          {placementBar?.selectedBall ? (
            <div
              className="pointer-events-none absolute left-1/2 top-2 z-[124] -translate-x-1/2"
              style={{ top: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
              aria-live="polite"
            >
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white shadow-md backdrop-blur-sm sm:text-xs">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      placementBar.selectedBall === "red"
                        ? "#c41e3a"
                        : placementBar.selectedBall === "yellow"
                          ? "#f5d033"
                          : "#f8f8f8",
                  }}
                  aria-hidden
                />
                {placementBar.selectedBall === "red"
                  ? "빨간 공"
                  : placementBar.selectedBall === "yellow"
                    ? "노란 공"
                    : "흰 공"}
              </div>
            </div>
          ) : null}

          <SolutionTableZoomShell
            className="relative min-h-0 flex-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
            contentWidth={cw}
            contentHeight={ch}
            focusCanvasX={zoomFocus.x}
            focusCanvasY={zoomFocus.y}
            fitMode="contain"
            panResetKey={placementBar?.selectedBall ?? "none"}
            panPointerPolicy={panPointerPolicy}
            forceShowZoomControls
          >
            {(zoom) => {
              zoomCtxRef.current = zoom;
              return (
                <div className="relative" style={{ width: cw, height: ch }}>
                  <BilliardTableEditor
                    ref={editorRef}
                    initialRed={initialRed}
                    initialYellow={initialYellow}
                    initialWhite={initialWhite}
                    initialCueBall={cueBall}
                    showGrid={gridOn}
                    gridOn={gridOn}
                    onGridChange={setGridOn}
                    drawStyle={drawStyle}
                    onDrawStyleChange={setDrawStyle}
                    interactive={true}
                    canvasOnly={true}
                    orientation={orientation}
                    cueBall={cueBall}
                    placementMode={true}
                    onPlacementBarInfo={onPlacementBarInfo}
                    cueBallSpotEnabled={cueSpotOn}
                    tableEmbedFill
                    fineTuneOverlayRoot={fineTuneOverlayRoot}
                  />
                </div>
              );
            }}
          </SolutionTableZoomShell>

          {/* 상단「수구」로만 열림 — 공배치 시작 시에는 표시하지 않음 */}
          {cuePickerOpen && (
            <div
              className="absolute inset-0 z-[220] flex items-center justify-center rounded-lg bg-transparent"
              aria-modal="true"
              role="dialog"
              aria-label="수구 선택"
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-transparent"
                aria-label="닫기"
                onClick={() => setCuePickerOpen(false)}
              />
              <div className="relative z-[1] mx-4 flex flex-col items-center rounded-xl bg-transparent px-6 py-5">
                <p
                  className="text-center text-base font-medium text-white mb-6"
                  style={{
                    textShadow:
                      "0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.6)",
                  }}
                >
                  수구를 선택하세요
                </p>
                <div className="flex gap-8 justify-center">
                  <button
                    type="button"
                    onClick={() => pickCue("white")}
                    className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                      cueBall === "white"
                        ? "border-site-primary ring-2 ring-site-primary/50"
                        : "border-white/20"
                    }`}
                    aria-label="흰공을 수구로"
                  >
                    <span
                      className="h-[60px] w-[60px] rounded-full bg-[#f8f8f8] shadow-inner block"
                      style={{
                        boxShadow:
                          "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.15)",
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => pickCue("yellow")}
                    className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                      cueBall === "yellow"
                        ? "border-site-primary ring-2 ring-site-primary/50"
                        : "border-white/20"
                    }`}
                    aria-label="노란공을 수구로"
                  >
                    <span
                      className="h-[60px] w-[60px] rounded-full bg-[#f5d033] block"
                      style={{
                        boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25)",
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 미세조정(▲◀▶▼): 뷰포트 정중앙·48px 고정 — 수구 모달(z-200) 아래 두지 않도록 같은 컬럼 안에서 쌓기 */}
          <div
            ref={setFineTuneOverlayRoot}
            className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center"
          />
        </div>
      </div>
    </div>
  );
}
