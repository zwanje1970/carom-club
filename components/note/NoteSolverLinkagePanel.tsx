"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
} from "@/lib/billiard-table-constants";
import type {
  NanguBallPlacement,
  NanguCurveNode,
  NanguPathPoint,
} from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { pathsFromTroubleSolutionDataJson } from "@/lib/trouble-solution-data-to-overlay";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";

type TroubleSolutionRow = {
  id: string;
  solutionData: Record<string, unknown> | null;
  goodCount: number;
  badCount: number;
  isAccepted: boolean;
};

function pickBestSolution(list: TroubleSolutionRow[]): TroubleSolutionRow | null {
  if (!list.length) return null;
  const accepted = list.find((s) => s.isAccepted);
  if (accepted) return accepted;
  return [...list].sort(
    (a, b) => b.goodCount - b.badCount - (a.goodCount - a.badCount)
  )[0];
}

interface NoteSolverLinkagePanelProps {
  noteId: string;
  noteImageUrl: string | null;
  isAuthor: boolean;
  linkedTroublePostId?: string | null;
  ballPlacement: NanguBallPlacement;
  cuePos: { x: number; y: number };
  onError: (message: string) => void;
}

export function NoteSolverLinkagePanel({
  noteId,
  noteImageUrl,
  isAuthor,
  linkedTroublePostId = null,
  ballPlacement,
  cuePos,
  onError,
}: NoteSolverLinkagePanelProps) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [pathOverlay, setPathOverlay] = useState<{
    pathPoints: NanguPathPoint[];
    objectPathPoints: NanguPathPoint[];
    cuePathDisplayCurves?: PathSegmentCurveControl[];
    objectPathDisplayCurves?: PathSegmentCurveControl[];
    cuePathCurveNodes?: NanguCurveNode[];
    objectPathCurveNodes?: NanguCurveNode[];
  } | null>(null);

  const previewOrientation = useTableOrientation();
  const rect = useMemo(
    () => getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    []
  );

  const firstObjectBallKey = useMemo(() => {
    if (!pathOverlay || pathOverlay.pathPoints.length === 0) return null;
    return resolveTroubleFirstObjectBallKey({
      placement: ballPlacement,
      cuePos,
      pathPoints: pathOverlay.pathPoints,
      objectPathPoints: pathOverlay.objectPathPoints,
      rect,
    });
  }, [ballPlacement, cuePos, pathOverlay, rect]);

  const handleTroubleRequest = useCallback(async () => {
    onError("");
    setRequesting(true);
    try {
      const res = await fetch("/api/community/trouble/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          noteId,
          imageUrl: noteImageUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      if (!data.id) throw new Error("응답이 올바르지 않습니다.");
      router.push(`/community/trouble/${data.id}/solution/new`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "오류");
    } finally {
      setRequesting(false);
    }
  }, [noteId, noteImageUrl, onError, router]);

  const loadSolutionOverlay = useCallback(async () => {
    if (!linkedTroublePostId) return;
    setImportError("");
    setImportLoading(true);
    try {
      const res = await fetch(`/api/community/trouble/${linkedTroublePostId}/solutions`, {
        credentials: "include",
      });
      const list = (await res.json()) as TroubleSolutionRow[];
      if (!res.ok || !Array.isArray(list)) {
        throw new Error("해법 목록을 불러오지 못했습니다.");
      }
      const best = pickBestSolution(list);
      if (!best?.solutionData) {
        setImportError("불러올 해법 데이터가 없습니다. 커뮤니티에서 해법이 등록되면 다시 시도해 주세요.");
        setPathOverlay(null);
        return;
      }
      const parsed = pathsFromTroubleSolutionDataJson(best.solutionData);
      if (
        parsed.pathPoints.length === 0 &&
        parsed.objectPathPoints.length === 0
      ) {
        setImportError("표시할 경로 좌표가 없는 해법입니다.");
        setPathOverlay(null);
        return;
      }
      setPathOverlay({
        pathPoints: parsed.pathPoints,
        objectPathPoints: parsed.objectPathPoints,
        cuePathDisplayCurves: parsed.cuePathDisplayCurves,
        objectPathDisplayCurves: parsed.objectPathDisplayCurves,
        cuePathCurveNodes: parsed.cuePathCurveNodes,
        objectPathCurveNodes: parsed.objectPathCurveNodes,
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "오류");
      setPathOverlay(null);
    } finally {
      setImportLoading(false);
    }
  }, [linkedTroublePostId]);

  const toggleImportPaths = async () => {
    if (pathOverlay) {
      setPathOverlay(null);
      setImportError("");
      return;
    }
    await loadSolutionOverlay();
  };

  if (!isAuthor) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={requesting}
          onClick={() => void handleTroubleRequest()}
          className="py-2.5 px-4 rounded-lg bg-site-primary text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 min-h-[44px]"
        >
          {requesting ? "이동 중…" : "난구해결 요청"}
        </button>
        {linkedTroublePostId && (
          <Link
            href={`/community/trouble/${linkedTroublePostId}`}
            className="py-2.5 px-4 rounded-lg border border-site-primary/60 text-site-primary font-medium text-sm min-h-[44px] inline-flex items-center"
          >
            연결된 난구해결 글 보기
          </Link>
        )}
      </div>

      {linkedTroublePostId && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/40 p-4 space-y-3">
          <p className="text-sm font-medium text-site-text">난구해결 연결</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/community/trouble/${linkedTroublePostId}`}
              className="inline-flex items-center justify-center rounded-lg bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 touch-manipulation min-h-[44px]"
            >
              연결된 난구해결 글 보기
            </Link>
            <button
              type="button"
              disabled={importLoading}
              onClick={() => void toggleImportPaths()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 touch-manipulation min-h-[44px] disabled:opacity-50"
            >
              {importLoading
                ? "불러오는 중…"
                : pathOverlay
                  ? "해법 경로 숨기기"
                  : "해법 불러오기"}
            </button>
          </div>
          {importError && <p className="text-sm text-amber-700 dark:text-amber-300">{importError}</p>}
          {pathOverlay && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                채택 해법이 있으면 우선 표시하고, 없으면 추천이 많은 해법 경로를 표시합니다.
              </p>
              <div
                className="relative mx-auto w-full max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
                style={{
                  maxWidth: DEFAULT_TABLE_WIDTH,
                  aspectRatio:
                    previewOrientation === "portrait"
                      ? `${DEFAULT_TABLE_HEIGHT} / ${DEFAULT_TABLE_WIDTH}`
                      : `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
                }}
              >
                <div className="absolute inset-0 z-0 pointer-events-none">
                  <NanguReadOnlyLayout
                    ballPlacement={ballPlacement}
                    fillContainer
                    embedFill
                    className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                    showGrid
                    drawStyle="realistic"
                    showCueBallSpot
                    showObjectBallSpot={firstObjectBallKey != null}
                    objectBallSpotKey={firstObjectBallKey}
                    orientation={previewOrientation}
                    betweenTableAndBallsLayer={
                      <NanguSolutionPathOverlay
                        pathPoints={pathOverlay.pathPoints}
                        cuePos={cuePos}
                        tableBallPlacement={ballPlacement}
                        objectPathPoints={pathOverlay.objectPathPoints}
                        orientation={previewOrientation}
                        pathMode={false}
                        objectPathMode={false}
                        pathLinesVisible
                        ballPickLayout={ballPlacement}
                        cueDisplayCurveControls={pathOverlay.cuePathDisplayCurves}
                        objectDisplayCurveControls={pathOverlay.objectPathDisplayCurves}
                        cuePathCurveNodes={pathOverlay.cuePathCurveNodes}
                        objectPathCurveNodes={pathOverlay.objectPathCurveNodes}
                        curveHandleInteraction={false}
                        curveHandlesShowSubtle={false}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
