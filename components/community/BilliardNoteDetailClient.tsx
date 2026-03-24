"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, NanguCurveNode, NanguPathPoint } from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { pathsFromTroubleSolutionDataJson } from "@/lib/trouble-solution-data-to-overlay";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import { getPlayfieldRect } from "@/lib/billiard-table-constants";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format-date";

interface NoteData {
  id: string;
  authorName: string;
  title: string | null;
  noteDate: Date | null;
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: "white" | "yellow";
  memo: string | null;
  imageUrl: string | null;
  visibility: string;
  /** 생성 시각 — RSC에서 Date 전달, 표시는 {@link formatKoreanDateTime}(초 생략) */
  createdAt: Date;
  isAuthor: boolean;
}

type TroubleSolutionRow = {
  id: string;
  solutionData: Record<string, unknown> | null;
  goodCount: number;
  badCount: number;
  isAccepted: boolean;
};

export interface BilliardNoteDetailClientProps {
  note: NoteData;
  /** 이 노트에서 생성·연결된 난구해결(community/trouble) 게시글 id */
  linkedTroublePostId?: string | null;
  basePath?: string;
}

function pickBestSolution(list: TroubleSolutionRow[]): TroubleSolutionRow | null {
  if (!list.length) return null;
  const accepted = list.find((s) => s.isAccepted);
  if (accepted) return accepted;
  return [...list].sort(
    (a, b) => b.goodCount - b.badCount - (a.goodCount - a.badCount)
  )[0];
}

export function BilliardNoteDetailClient({
  note,
  linkedTroublePostId = null,
  basePath = "/mypage/notes",
}: BilliardNoteDetailClientProps) {
  const router = useRouter();
  const [error, setError] = useState("");
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

  const ballPlacement: NanguBallPlacement = useMemo(
    () => ({
      redBall: note.redBall,
      yellowBall: note.yellowBall,
      whiteBall: note.whiteBall,
      cueBall: note.cueBall,
    }),
    [note]
  );

  const cuePos = note.cueBall === "yellow" ? note.yellowBall : note.whiteBall;

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

  const handleDelete = async () => {
    if (!note.isAuthor) return;
    if (!confirm("이 난구노트를 삭제할까요?")) return;
    setError("");
    const res = await fetch(`/api/community/billiard-notes/${note.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.push(basePath);
  };

  const handleTroubleRequest = useCallback(async () => {
    setError("");
    setRequesting(true);
    try {
      const res = await fetch("/api/community/trouble/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          noteId: note.id,
          imageUrl: note.imageUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      if (!data.id) throw new Error("응답이 올바르지 않습니다.");
      router.push(`/community/trouble/${data.id}/solution/new`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setRequesting(false);
    }
  }, [note.id, note.imageUrl, router]);

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

  const tableImage = note.imageUrl ? (
    <img
      src={note.imageUrl}
      alt="저장된 당구대 배치"
      className="max-w-full h-auto block w-full"
    />
  ) : (
    <div className="w-full aspect-[2/1] flex items-center justify-center text-gray-500 bg-gray-100 dark:bg-slate-800">
      이미지 없음
    </div>
  );

  const actionBar = note.isAuthor && (
    <>
      <button
        type="button"
        disabled={requesting}
        onClick={() => void handleTroubleRequest()}
        className="flex-1 min-w-0 py-2.5 rounded-lg bg-site-primary text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 touch-manipulation"
      >
        {requesting ? "이동 중…" : "난구해결 요청"}
      </button>
      {linkedTroublePostId && (
        <Link
          href={`/community/trouble/${linkedTroublePostId}`}
          className="flex-1 min-w-0 py-2.5 rounded-lg border border-site-primary/60 text-site-primary font-medium text-sm text-center hover:bg-site-primary/10 touch-manipulation"
        >
          연결된 글
        </Link>
      )}
      <Link
        href={`${basePath}/${note.id}/edit`}
        className="flex-1 min-w-0 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 font-medium text-sm text-center hover:bg-gray-50 dark:hover:bg-slate-800"
      >
        수정
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="flex-1 min-w-0 py-2.5 rounded-lg border border-red-300 text-red-600 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        삭제
      </button>
    </>
  );

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <div className="rounded-lg overflow-hidden bg-gray-900 flex justify-center">
        {note.isAuthor ? (
          <Link
            href={`${basePath}/${note.id}/edit`}
            className="flex justify-center focus:outline-none focus:ring-2 focus:ring-site-primary/50 rounded-lg"
            aria-label="당구공 배치 화면으로 이동"
          >
            {tableImage}
          </Link>
        ) : (
          tableImage
        )}
      </div>

      {linkedTroublePostId && note.isAuthor && (
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

      {note.noteDate && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          기록 날짜: {formatKoreanDate(note.noteDate)}
        </p>
      )}
      {note.memo && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">내용</h2>
          <p className="text-site-text whitespace-pre-wrap">{note.memo}</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        {note.authorName} · {formatKoreanDateTime(note.createdAt)}
        {" · "}
        {note.visibility === "community" ? "커뮤니티 게시" : "비공개"}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {note.isAuthor && (
        <div className="hidden md:flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-slate-600">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={requesting}
              onClick={() => void handleTroubleRequest()}
              className="px-4 py-2.5 rounded-lg bg-site-primary text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 min-h-[44px]"
            >
              {requesting ? "이동 중…" : "난구해결 요청"}
            </button>
            {linkedTroublePostId && (
              <Link
                href={`/community/trouble/${linkedTroublePostId}`}
                className="px-4 py-2.5 rounded-lg border border-site-primary/60 text-site-primary font-medium text-sm min-h-[44px] inline-flex items-center"
              >
                연결된 난구해결 글 보기
              </Link>
            )}
            <Link
              href={`${basePath}/${note.id}/edit`}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 font-medium text-sm inline-flex items-center min-h-[44px]"
            >
              수정
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 font-medium text-sm min-h-[44px]"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {note.isAuthor && (
        <div className="fixed bottom-20 left-0 right-0 z-30 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-gray-200 dark:border-slate-700 md:hidden">
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            <div className="flex gap-2 flex-wrap">{actionBar}</div>
          </div>
        </div>
      )}
    </div>
  );
}
