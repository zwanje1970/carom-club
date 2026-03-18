"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BilliardTableEditor,
  type BilliardTableEditorHandle,
} from "@/components/billiard";
import type { BallColor, CueBallType } from "@/lib/billiard-table-constants";
import type { TableOrientation } from "@/lib/billiard-table-constants";
import { useBallPlacementFullscreen } from "./BallPlacementFullscreenContext";

function KebabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
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
}: MobileBallPlacementFullscreenProps) {
  const router = useRouter();
  const editorRef = useRef<BilliardTableEditorHandle>(null);
  const fullscreen = useBallPlacementFullscreen();
  const [cueBall, setCueBall] = useState<CueBallType | null>(
    initialCueBall ?? null
  );
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [drawStyle, setDrawStyle] = useState<"realistic" | "wireframe">("realistic");
  const orientation = useTableOrientation();
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

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
        memo: "",
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

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-site-bg"
      style={{ padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}
    >
      {/* 상단: 좌표·공선택 | 점3개·완료 — 한 줄·max-w-2xl */}
      <div className="w-full flex justify-center px-2 pt-2 z-10 shrink-0">
        <div className="w-full max-w-2xl flex items-center gap-2 min-h-9">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-1">
            {placementBar?.selectedBall ? (
              <>
                <span
                  className="text-[11px] sm:text-xs font-mono tabular-nums text-site-text font-medium"
                  aria-live="polite"
                >
                  X:{placementBar.x.toFixed(3)} Y:{placementBar.y.toFixed(3)}
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-site-text shrink-0">
                  ●
                  {placementBar.selectedBall === "red"
                    ? "빨간"
                    : placementBar.selectedBall === "yellow"
                      ? "노란"
                      : "흰"}
                  공
                </span>
              </>
            ) : (
              <span className="text-[11px] text-site-text/50">공을 탭해 선택</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20 dark:bg-white/20 text-site-text backdrop-blur-sm hover:bg-black/30 dark:hover:bg-white/30"
              aria-label="메뉴"
              aria-expanded={menuOpen}
            >
              <KebabIcon className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute left-0 top-full mt-1 min-w-[140px] rounded-lg border border-gray-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 shadow-lg py-1 z-20 backdrop-blur-sm"
                role="menu"
              >
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  보기
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setDrawStyle("realistic"); setMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm ${drawStyle === "realistic" ? "bg-site-primary/10 text-site-primary font-medium" : "text-site-text"}`}
                >
                  실사보기
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setDrawStyle("wireframe"); setMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm ${drawStyle === "wireframe" ? "bg-site-primary/10 text-site-primary font-medium" : "text-site-text"}`}
                >
                  단순보기
                </button>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700 mt-1">
                  그리드
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setGridOn(true); setMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm ${gridOn ? "bg-site-primary/10 text-site-primary font-medium" : "text-site-text"}`}
                >
                  그리드 ON
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setGridOn(false); setMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm ${!gridOn ? "bg-site-primary/10 text-site-primary font-medium" : "text-site-text"}`}
                >
                  그리드 OFF
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving || !cueBall}
            className="flex items-center gap-1 rounded-lg bg-site-primary px-2.5 py-1.5 text-xs font-medium text-white shadow disabled:opacity-50"
            aria-label="저장 후 완료"
          >
            <span>{saving ? "저장 중…" : "완료"}</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          </div>
        </div>
      </div>

      {/* 당구대 전체 영역 (세로 가득) */}
      <div className="flex flex-1 min-h-0 w-full items-center justify-center p-2">
        <div className="relative h-full w-full max-w-2xl flex items-center justify-center">
          <BilliardTableEditor
            ref={editorRef}
            initialRed={initialRed}
            initialYellow={initialYellow}
            initialWhite={initialWhite}
            initialCueBall={cueBall ?? undefined}
            showGrid={gridOn}
            gridOn={gridOn}
            onGridChange={setGridOn}
            drawStyle={drawStyle}
            onDrawStyleChange={setDrawStyle}
            interactive={cueBall !== null}
            canvasOnly={true}
            orientation={orientation}
            cueBall={cueBall ?? undefined}
            placementMode={true}
            onPlacementBarInfo={onPlacementBarInfo}
          />

          {/* 수구 미선택 시 중앙 반투명 오버레이 */}
          {cueBall === null && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"
              aria-modal="true"
              role="dialog"
              aria-label="수구 선택"
            >
              <div className="mx-4 rounded-xl bg-transparent px-6 py-5">
                <p className="text-center text-base font-medium text-white mb-4">
                  수구선택 후 공을 배치하세요
                </p>
                <div className="flex gap-6 justify-center">
                  <button
                    type="button"
                    onClick={() => setCueBall("white")}
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 shadow-md hover:scale-110 hover:border-white/60 transition-transform"
                    aria-label="흰공"
                  >
                    <span className="h-10 w-10 rounded-full bg-[#f8f8f8] shadow-inner" style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.15)" }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCueBall("yellow")}
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 shadow-md hover:scale-110 hover:border-white/60 transition-transform"
                    aria-label="노란공"
                  >
                    <span className="h-10 w-10 rounded-full bg-[#f5d033]" style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25)" }} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
