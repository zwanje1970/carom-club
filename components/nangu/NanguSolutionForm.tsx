"use client";

import React, { useState, useRef, useCallback } from "react";
import { BilliardTableCanvas } from "@/components/billiard";
import {
  getPlayfieldRect,
  pixelToNormalized,
  normalizedToPixel,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";

export interface NanguSolutionFormProps {
  ballPlacement: NanguBallPlacement;
  onSubmit: (payload: {
    title?: string | null;
    comment?: string | null;
    data: NanguSolutionData;
  }) => Promise<void>;
}

type PathPoints = { x: number; y: number }[];

/** 두께 표시: 0/8 ~ 8/8 (저장값 0..1, 1/16 스텝) */
function thicknessToDisplay(v: number) {
  const step = 1 / 16;
  const n = Math.round(v / step) * step;
  const eighths = Math.round(n * 8 * 2) / 2;
  return `${eighths}/8`;
}

export function NanguSolutionForm({ ballPlacement, onSubmit }: NanguSolutionFormProps) {
  const [isBankShot, setIsBankShot] = useState(false);
  const [thicknessOffsetX, setThicknessOffsetX] = useState(0.5);
  const [tipX, setTipX] = useState<number | undefined>();
  const [tipY, setTipY] = useState<number | undefined>();
  const [paths, setPaths] = useState<PathPoints[]>([[]]);
  const [reflectionPath, setReflectionPath] = useState<PathPoints | null>(null);
  const [showReflectionPrompt, setShowReflectionPrompt] = useState(false);
  const [reflectionAnswered, setReflectionAnswered] = useState(false);
  const [reflectionPathDone, setReflectionPathDone] = useState(false);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [speed, setSpeed] = useState<number | undefined>();
  const [depth, setDepth] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

  const getNormalizedFromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = containerRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const scaleX = DEFAULT_TABLE_WIDTH / r.width;
      const scaleY = DEFAULT_TABLE_HEIGHT / r.height;
      const px = (clientX - r.left) * scaleX;
      const py = (clientY - r.top) * scaleY;
      if (
        px >= rect.left &&
        px <= rect.left + rect.width &&
        py >= rect.top &&
        py <= rect.top + rect.height
      ) {
        return pixelToNormalized(px, py, rect);
      }
      return null;
    },
    [rect.left, rect.top, rect.width, rect.height]
  );

  const currentPath = paths[paths.length - 1];
  const canAddPoint = currentPath && currentPath.length < 20;
  const addPoint = (norm: { x: number; y: number }) => {
    if (!canAddPoint) return;
    setPaths((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), [...last, norm]];
    });
  };

  const addNewPath = () => {
    setPaths((prev) => [...prev, []]);
  };

  const removeLastPoint = () => {
    setPaths((prev) => {
      const last = prev[prev.length - 1];
      if (!last?.length) return prev;
      const next = [...last];
      next.pop();
      return [...prev.slice(0, -1), next];
    });
  };

  const handleReflectionYes = () => {
    setReflectionAnswered(true);
    setShowReflectionPrompt(false);
    setReflectionPath([]);
    setReflectionPathDone(false);
  };
  const handleReflectionNo = () => {
    setReflectionAnswered(true);
    setShowReflectionPrompt(false);
    setReflectionPathDone(true);
  };

  const addReflectionPoint = (norm: { x: number; y: number }) => {
    setReflectionPath((prev) => (prev ?? []).concat(norm));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validPaths = paths.filter((p) => p.length >= 2);
    if (validPaths.length === 0) {
      setError("최소 하나의 경로(스팟 2개 이상)를 그려주세요.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim() || null,
        comment: comment.trim() || null,
        data: {
          isBankShot,
          thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
          tipX: tipX ?? undefined,
          tipY: tipY ?? undefined,
          paths: validPaths.map((points) => ({ points })),
          reflectionPath:
            reflectionPath && reflectionPath.length >= 2
              ? { points: reflectionPath }
              : undefined,
          speed,
          depth,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const pathEditorMode = !reflectionAnswered
    ? "cue"
    : !reflectionPathDone
      ? "reflection"
      : "done";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isBankShot}
            onChange={(e) => setIsBankShot(e.target.checked)}
          />
          <span>뱅크샷 모드 (두께 단계 생략)</span>
        </label>
      </div>

      {!isBankShot && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            두께 (목적구 고정·수구 좌우 겹침) — 현재: {thicknessToDisplay(thicknessOffsetX)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={1 / 16}
            value={thicknessOffsetX}
            onChange={(e) => setThicknessOffsetX(e.target.valueAsNumber)}
            className="w-full max-w-xs"
          />
          <p className="text-xs text-gray-500 mt-1">드래그 방식 UI는 추후 적용 예정. 당점은 수구 위 스팟으로 추후 추가.</p>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {pathEditorMode === "cue" &&
            "테이블을 클릭해 수구 경로의 스팟을 순서대로 찍으세요. 여러 경로를 그리려면 «새 경로» 후 다시 클릭하세요."}
          {pathEditorMode === "reflection" &&
            "1목적구 반사각 경로 스팟을 순서대로 클릭하세요."}
          {pathEditorMode === "done" && "경로 입력이 완료되었습니다."}
        </p>
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 w-full max-w-full cursor-crosshair"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
          onClick={(e) => {
            const norm = getNormalizedFromEvent(e.clientX, e.clientY);
            if (!norm) return;
            if (pathEditorMode === "cue") addPoint(norm);
            if (pathEditorMode === "reflection") addReflectionPoint(norm);
          }}
        >
          <BilliardTableCanvas
            width={DEFAULT_TABLE_WIDTH}
            height={DEFAULT_TABLE_HEIGHT}
            redBall={ballPlacement.redBall}
            yellowBall={ballPlacement.yellowBall}
            whiteBall={ballPlacement.whiteBall}
            cueBall={ballPlacement.cueBall}
            interactive={false}
            showGrid={true}
            showCueBallSpot={pathEditorMode === "cue"}
          />
          <NanguPathOverlay
            paths={paths}
            reflectionPath={reflectionPath ?? []}
            width={DEFAULT_TABLE_WIDTH}
            height={DEFAULT_TABLE_HEIGHT}
          />
        </div>
        {pathEditorMode === "cue" && (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={removeLastPoint} className="text-sm text-site-primary underline">
              마지막 스팟 취소
            </button>
            <button type="button" onClick={addNewPath} className="text-sm text-site-primary underline">
              새 경로
            </button>
            {paths.some((p) => p.length >= 2) && !showReflectionPrompt && !reflectionAnswered && (
              <button
                type="button"
                onClick={() => setShowReflectionPrompt(true)}
                className="text-sm text-site-primary underline"
              >
                경로 완료 후 반사각 선택
              </button>
            )}
          </div>
        )}
        {pathEditorMode === "reflection" && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setReflectionPathDone(true)}
              className="text-sm text-site-primary underline"
            >
              반사각 경로 완료
            </button>
          </div>
        )}
      </div>

      {showReflectionPrompt && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4">
          <p className="font-medium mb-2">1목적구 반사각을 제시하시겠습니까?</p>
          <div className="flex gap-3">
            <button type="button" onClick={handleReflectionYes} className="py-2 px-4 rounded-lg bg-site-primary text-white">
              예
            </button>
            <button type="button" onClick={handleReflectionNo} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600">
              아니오
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">해법 제목 (선택)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
          placeholder="예: 3쿠션 풀볼"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명 (선택)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
          placeholder="해법 설명"
        />
      </div>
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">속도 (선택)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={speed ?? ""}
            onChange={(e) => setSpeed(e.target.value ? e.target.valueAsNumber : undefined)}
            className="w-20 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">깊이 (선택)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={depth ?? ""}
            onChange={(e) => setDepth(e.target.value ? e.target.valueAsNumber : undefined)}
            className="w-20 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
          />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || paths.filter((p) => p.length >= 2).length === 0}
          className="py-2 px-4 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
        >
          {saving ? "저장 중…" : "해법 등록"}
        </button>
      </div>
    </form>
  );
}

function NanguPathOverlay({
  paths,
  reflectionPath,
  width,
  height,
}: {
  paths: PathPoints[];
  reflectionPath: PathPoints;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const rect = getPlayfieldRect(width, height);

    const drawPath = (points: { x: number; y: number }[], color: string) => {
      if (points.length < 2) return;
      for (let i = 0; i < points.length - 1; i++) {
        const a = normalizedToPixel(points[i].x, points[i].y, rect);
        const b = normalizedToPixel(points[i + 1].x, points[i + 1].y, rect);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
        const isLast = i === points.length - 2;
        if (isLast) {
          const dx = b.px - a.px;
          const dy = b.py - a.py;
          const angle = Math.atan2(dy, dx);
          const al = 12;
          const ar = (30 * Math.PI) / 180;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(b.px, b.py);
          ctx.lineTo(b.px - al * Math.cos(angle - ar), b.py - al * Math.sin(angle - ar));
          ctx.lineTo(b.px - al * Math.cos(angle + ar), b.py - al * Math.sin(angle + ar));
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    const pathColor = "rgb(57,255,20)"; // 형광연두색
    paths.forEach((p) => drawPath(p, pathColor));
    if (reflectionPath.length >= 2) drawPath(reflectionPath, pathColor);
  }, [paths, reflectionPath, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    />
  );
}
