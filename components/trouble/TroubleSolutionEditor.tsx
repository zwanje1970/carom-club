"use client";

/**
 * ?쒓뎄?닿껐??trouble) ?꾩슜 ?대쾿 ?몄쭛湲????곗꽑 ?덉젙?????(docs/NANGU_SOLUTION_ROLLOUT.md).
 * - ?먮낯: layoutImageUrl(?대?吏) ?먮뒗 ballPlacement(醫뚰몴) ?쎄린 ?꾩슜 誘몃━蹂닿린
 * - 寃쎈줈 ?몄쭛: ?꾩껜?붾㈃留?(?ㅽ뙚쨌以뙿룹븷?덈찓?댁뀡)
 * - ??? content(?댁꽕) + solutionData(JSON)
 */
import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect } from "react";
import { getPlayfieldRect, DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguCurveNode, NanguSolutionData } from "@/lib/nangu-types";
import type { NanguPathPoint } from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import {
  BALL_SPEED_OPTIONS,
  ballSpeedToLegacySpeed,
  ballSpeedToLegacySpeedLevel,
  ballSpeedToRailCount,
  getRailDisplayPowerForBallSpeed,
  normalizeBallSpeed,
  type BallSpeed,
} from "@/lib/ball-speed-constants";
import { SolutionPathEditorFullscreen } from "@/components/nangu/SolutionPathEditorFullscreen";
import {
  DEFAULT_SOLUTION_SETTINGS,
  clampSolutionSettings,
  mergeSolutionSettings,
  type SolutionSettingsValue,
} from "@/lib/solution-settings-panel-value";
import {
  computeCueBallNormFromPanelSettings,
  panelThicknessFromMainThicknessOffset,
  thicknessOffsetXFromThicknessStep,
} from "@/lib/solution-panel-ball-layout";
import {
  createTroubleSolutionEditorInitialState,
  resolvePanelSettingsAndAuthority,
} from "@/lib/solution-editor-hydrate";
import {
  pickInitialIgnorePhysics,
  writeIgnorePhysicsPreference,
} from "@/lib/solution-ignore-physics-preference";
import {
  cueFirstObjectHitFromBallPlacement,
  resolveEffectiveFirstObjectCollisionFromCuePath,
} from "@/lib/solution-path-geometry";

export interface TroubleSolutionEditorProps {
  /** ?대?吏留??덉쓣 ???ъ슜. ballPlacement ?덉쑝硫?臾댁떆 媛??*/
  layoutImageUrl: string | null;
  /** 醫뚰몴 湲곕컲 諛곗튂 (?덉쑝硫??쎄린 ?꾩슜 ?뚯씠釉??뚮뜑, ?놁쑝硫??대?吏 ?쒖떆) */
  ballPlacement: NanguBallPlacement | null;
  /** ??λ맂 ?대쾿 JSON ??硫붿씤쨌?⑤꼸쨌寃쎈줈쨌蹂몃Ц 蹂듭썝 */
  initialSolutionData?: Partial<NanguSolutionData> | null;
  /** `initialSolutionData.settings`留??곕줈 ?섍만 ??*/
  initialPersistedSettings?: SolutionSettingsValue | null;
  /** trouble ?대쾿 蹂몃Ц(?댁꽕 ?띿뒪?? */
  initialContent?: string | null;
  onSubmit: (payload: { content: string; solutionData: NanguSolutionData }) => Promise<void>;
}

export function TroubleSolutionEditor({
  layoutImageUrl,
  ballPlacement,
  initialSolutionData = null,
  initialPersistedSettings = null,
  initialContent = null,
  onSubmit,
}: TroubleSolutionEditorProps) {
  const ih = useMemo(
    () =>
      createTroubleSolutionEditorInitialState(
        initialSolutionData,
        initialPersistedSettings,
        initialContent,
        ballPlacement
      ),
    [initialSolutionData, initialPersistedSettings, initialContent, ballPlacement]
  );

  const [isBankShot, setIsBankShot] = useState(ih.isBankShot);
  const [thicknessOffsetX, setThicknessOffsetX] = useState(ih.thicknessOffsetX);
  const [spinX, setSpinX] = useState(ih.spinX);
  const [spinY, setSpinY] = useState(ih.spinY);
  const [backstrokeLevel, setBackstrokeLevel] = useState(ih.backstrokeLevel);
  const [followStrokeLevel, setFollowStrokeLevel] = useState(ih.followStrokeLevel);
  const [ballSpeed, setBallSpeed] = useState<BallSpeed>(ih.ballSpeed);
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>(ih.pathPoints);
  const [objectPathPoints, setObjectPathPoints] = useState<NanguPathPoint[]>(ih.objectPathPoints);
  const [cuePathDisplayCurves, setCuePathDisplayCurves] = useState<PathSegmentCurveControl[]>(ih.cuePathDisplayCurves);
  const [objectPathDisplayCurves, setObjectPathDisplayCurves] = useState<PathSegmentCurveControl[]>(
    ih.objectPathDisplayCurves
  );
  const [cuePathCurveNodes, setCuePathCurveNodes] = useState<NanguCurveNode[]>(ih.cuePathCurveNodes);
  const [objectPathCurveNodes, setObjectPathCurveNodes] = useState<NanguCurveNode[]>(ih.objectPathCurveNodes);
  const [pathFsOpen, setPathFsOpen] = useState(() => !!(ballPlacement || layoutImageUrl));
  const [pathFsKey, setPathFsKey] = useState(0);

  /** 諛곗튂/?대?吏媛 ?덉쑝硫??섏씤???꾩뿉 ?꾩껜?붾㈃ 寃쎈줈 ?몄쭛??耳?以묎컙(?ㅼ젙 ?? 源쒕묀?꾩쓣 以꾩엫 */
  useLayoutEffect(() => {
    if (ballPlacement || layoutImageUrl) {
      setPathFsOpen(true);
    } else {
      setPathFsOpen(false);
    }
  }, [ballPlacement, layoutImageUrl]);
  const [explanationText, setExplanationText] = useState(ih.explanationText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [settingsFocusSection, setSettingsFocusSection] = useState<
    null | "thickness" | "tip" | "rail"
  >(null);
  /**
   * true硫?誘몃땲 ?⑤꼸??蹂쇱뒪?쇰뱶쨌?먭퍡(physics)쨌?섍뎄 諛곗튂 ?ㅻ쾭?쇱씠?쑣톞ipNorm ?쒖떆瑜?二쇰룄.
   * 誘몄궗????硫붿씤 ?щ씪?대뜑/諛곗튂留??ъ슜.
   */
  const [settingsPanelBallSpeedAuthoritative, setSettingsPanelBallSpeedAuthoritative] = useState(
    () => resolvePanelSettingsAndAuthority(initialSolutionData, initialPersistedSettings).authoritative
  );
  const [panelSettings, setPanelSettings] = useState<SolutionSettingsValue>(() => {
    const resolved = resolvePanelSettingsAndAuthority(initialSolutionData, initialPersistedSettings);
    const rawSettings = initialPersistedSettings ?? initialSolutionData?.settings;
    const ignorePhysics = pickInitialIgnorePhysics(rawSettings, resolved.settings);
    return clampSolutionSettings(mergeSolutionSettings({ ignorePhysics }, resolved.settings));
  });

  const openSettingsPanel = useCallback(
    (section?: "thickness" | "tip" | "rail") => {
      setSettingsFocusSection(section ?? null);
      setPanelSettings((prev) => {
        /** 에디터 동기화 병합이 덮어쓰지 않도록, 열기 직전 사용자 선택 유지 */
        const preserveIgnorePhysics = prev.ignorePhysics;
        const base = {
          ballSpeed,
          backstroke: backstrokeLevel,
          followStroke: followStrokeLevel,
        };
        let merged: SolutionSettingsValue;
        if (!settingsPanelBallSpeedAuthoritative) {
          merged = clampSolutionSettings(
            mergeSolutionSettings(
              {
                ...base,
                railCount: ballSpeedToRailCount(ballSpeed),
                ...panelThicknessFromMainThicknessOffset(thicknessOffsetX),
              },
              prev
            )
          );
        } else {
          merged = clampSolutionSettings(mergeSolutionSettings(base, prev));
        }
        return clampSolutionSettings(
          mergeSolutionSettings({ ignorePhysics: preserveIgnorePhysics }, merged)
        );
      });
      setSettingsPanelBallSpeedAuthoritative(true);
      setSettingsPanelOpen(true);
    },
    [
      settingsPanelBallSpeedAuthoritative,
      ballSpeed,
      backstrokeLevel,
      followStrokeLevel,
      thicknessOffsetX,
    ]
  );

  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

  const cueBallNormFromPanel = useMemo(() => {
    if (!ballPlacement) return null;
    return computeCueBallNormFromPanelSettings(ballPlacement.redBall, panelSettings, rect);
  }, [ballPlacement, panelSettings, rect]);

  const ballNormOverridesForPanel = useMemo(() => {
    /** ?쒖떆???섍뎄 ?ㅻ쾭?쇱씠?쒕뒗 ?ㅼ젙李쎌씠 ?대┛ ?숈븞?먮쭔 ?곸슜 (?좊땲硫붿씠??醫뚰몴 濡쒖쭅怨?遺꾨━) */
    if (!settingsPanelBallSpeedAuthoritative || !settingsPanelOpen || !ballPlacement || !cueBallNormFromPanel) {
      return undefined;
    }
    const k = ballPlacement.cueBall === "yellow" ? "yellow" : "white";
    return { [k]: cueBallNormFromPanel } as Partial<
      Record<"red" | "yellow" | "white", { x: number; y: number }>
    >;
  }, [settingsPanelBallSpeedAuthoritative, settingsPanelOpen, ballPlacement, cueBallNormFromPanel]);

  const cuePos = ballPlacement
    ? settingsPanelBallSpeedAuthoritative && cueBallNormFromPanel
      ? cueBallNormFromPanel
      : ballPlacement.cueBall === "yellow"
        ? ballPlacement.yellowBall
        : ballPlacement.whiteBall
    : { x: 0.5, y: 0.5 };

  const effectiveThicknessOffsetX = useMemo(() => {
    if (!settingsPanelBallSpeedAuthoritative) return thicknessOffsetX;
    const step = panelSettings?.thicknessStep;
    if (step == null || Number.isNaN(step)) return thicknessOffsetX;
    return thicknessOffsetXFromThicknessStep(step, panelSettings.cueSide);
  }, [
    settingsPanelBallSpeedAuthoritative,
    panelSettings?.thicknessStep,
    panelSettings.cueSide,
    thicknessOffsetX,
  ]);

  const effectiveBallSpeed = useMemo(() => {
    if (!settingsPanelBallSpeedAuthoritative) return ballSpeed;
    const v = panelSettings?.railCount;
    if (v == null || Number.isNaN(Number(v))) return ballSpeed;
    return normalizeBallSpeed(v);
  }, [settingsPanelBallSpeedAuthoritative, panelSettings?.railCount, ballSpeed]);

  /** 誘몃━蹂닿린 1紐?留겶룹?????`lib/trouble-first-object-ball.ts`? ?숈씪(?ㅽ뙚 ?놁쑝硫?null) */
  const firstObjectBallKey = useMemo(() => {
    if (!ballPlacement) return null;
    return resolveTroubleFirstObjectBallKey({
      placement: ballPlacement,
      cuePos,
      pathPoints,
      objectPathPoints,
      rect,
    });
  }, [ballPlacement, cuePos, pathPoints, objectPathPoints, rect]);

  const firstObjectCollision = useMemo(() => {
    if (!ballPlacement || pathPoints.length < 1) return null;
    return resolveEffectiveFirstObjectCollisionFromCuePath(ballPlacement, cuePos, pathPoints, rect);
  }, [ballPlacement, cuePos, pathPoints, rect]);

  const openPathFullscreen = useCallback(() => {
    setPathFsKey((k) => k + 1);
    setPathFsOpen(true);
  }, []);

  const clearCommittedPath = useCallback(() => {
    setPathPoints([]);
    setObjectPathPoints([]);
    setCuePathDisplayCurves([]);
    setObjectPathDisplayCurves([]);
    setCuePathCurveNodes([]);
    setObjectPathCurveNodes([]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath = pathPoints.length >= 1 ? pathPoints.map((p) => ({ x: p.x, y: p.y })) : [];
      let reflectionPath: NanguSolutionData["reflectionPath"];
      let reflectionObjectBall: NanguSolutionData["reflectionObjectBall"];
      /**
       * 저장용 충돌점/1목 키: `resolveEffectiveFirstObjectCollisionFromCuePath`는 폴리라인이 광선 충돌점에
       * 닿았을 때만 유효(편집·표시 게이트). 제출 시에는 화면에 그린 1목 경로가 있으면 광선 1목만으로도
       * 직렬화해 재진입 복원이 되게 한다. 재생/물리/rAF는 사용하지 않음.
       */
      if (objectPathPoints.length >= 1 && ballPlacement && pathPoints.length >= 1) {
        const rayHit = cueFirstObjectHitFromBallPlacement(
          cuePos,
          pathPoints[0]!,
          ballPlacement,
          rect
        );
        const collisionForSave = firstObjectCollision ?? rayHit;
        const objectKeyForSave = firstObjectBallKey ?? rayHit?.objectKey ?? null;
        if (collisionForSave) {
          const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
          const startNorm = collisionForSave.collision;
          const startsAtCollision =
            objectPathPoints.length > 0 &&
            Math.abs(objectPathPoints[0]!.x - startNorm.x) < 1e-6 &&
            Math.abs(objectPathPoints[0]!.y - startNorm.y) < 1e-6;
          reflectionPath = {
            points: startsAtCollision ? objPts : [{ x: startNorm.x, y: startNorm.y }, ...objPts],
            pointsWithType: objectPathPoints,
          };
          if (objectKeyForSave) {
            reflectionObjectBall = objectKeyForSave;
          }
        }
      }

      const solutionData: NanguSolutionData = {
        isBankShot,
        thicknessOffsetX: isBankShot ? undefined : effectiveThicknessOffsetX,
        tipX: spinX,
        tipY: spinY,
        spinX,
        spinY,
        paths: pointsForPath.length >= 1 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
        reflectionPath,
        reflectionObjectBall,
        backstrokeLevel,
        followStrokeLevel,
        ballSpeed: effectiveBallSpeed,
        speedLevel: ballSpeedToLegacySpeedLevel(effectiveBallSpeed),
        speed: ballSpeedToLegacySpeed(effectiveBallSpeed),
        explanationText: explanationText.trim() || undefined,
        cuePathDisplayCurves:
          cuePathDisplayCurves.length > 0 ? cuePathDisplayCurves : undefined,
        objectPathDisplayCurves:
          objectPathDisplayCurves.length > 0 ? objectPathDisplayCurves : undefined,
        cuePathCurveNodes: cuePathCurveNodes.length > 0 ? cuePathCurveNodes : undefined,
        objectPathCurveNodes:
          objectPathCurveNodes.length > 0 ? objectPathCurveNodes : undefined,
        settings: settingsPanelBallSpeedAuthoritative
          ? clampSolutionSettings(panelSettings)
          : undefined,
      };
      await onSubmit({
        content: explanationText.trim(),
        solutionData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const showImageOnly = !ballPlacement && layoutImageUrl;

  const C = TROUBLE_SOLUTION_CONSOLE;

  const previewDisabled = !ballPlacement && !showImageOnly;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 flex flex-col"
      data-trouble-console={C.root}
    >
      {previewDisabled && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
          data-trouble-region={C.region.readonlyLayout}
        >
          怨듬같移??뺣낫媛 ?놁뼱 寃쎈줈 ?대쾿???묒꽦?????놁뒿?덈떎. ??寃뚯떆臾쇱뿉 諛곗튂??醫뚰몴 ?먮뒗 ?대?吏)媛 ?덉뼱???⑸땲??
        </div>
      )}

      {/* ?쒓뎄?대쾿 ?쒖떆: 以묎컙 諛곗튂???ㅼ젙 ???놁씠 怨㏓컮濡?寃쎈줈???꾩껜?붾㈃ ??DOM ?쒖꽌??癒쇱? 留덉슫??*/}
      {!previewDisabled && pathFsOpen && (
        <SolutionPathEditorFullscreen
          key={pathFsKey}
          variant="trouble"
          presentation="noteBallPlacementFullscreen"
          readOnlyCueAndBalls={!!ballPlacement}
          ballPlacement={ballPlacement}
          panelBallNormOverrides={ballNormOverridesForPanel}
          panelCueTipNorm={
            settingsPanelBallSpeedAuthoritative ? panelSettings.tipNorm : null
          }
          layoutImageUrl={ballPlacement ? null : layoutImageUrl}
          initialPathPoints={pathPoints}
          initialObjectPathPoints={objectPathPoints}
          initialCuePathDisplayCurves={cuePathDisplayCurves}
          initialObjectPathDisplayCurves={objectPathDisplayCurves}
          initialCuePathCurveNodes={cuePathCurveNodes}
          initialObjectPathCurveNodes={objectPathCurveNodes}
          thicknessOffsetX={effectiveThicknessOffsetX}
          isBankShot={isBankShot}
          ballSpeed={effectiveBallSpeed}
          settingsValue={panelSettings}
          onSettingsChange={(next) => {
            setSettingsPanelBallSpeedAuthoritative(true);
            setPanelSettings(next);
            writeIgnorePhysicsPreference(next.ignorePhysics);
            if (next.railCount != null && !Number.isNaN(Number(next.railCount))) {
              setBallSpeed(normalizeBallSpeed(next.railCount));
            }
          }}
          settingsOpen={settingsPanelOpen}
          onSettingsOpen={openSettingsPanel}
          onSettingsClose={() => {
            setSettingsPanelOpen(false);
            setSettingsFocusSection(null);
          }}
          settingsFocusSection={settingsFocusSection}
          onCancel={() => {
            if (typeof window !== "undefined" && !window.confirm("경로 편집을 종료할까요?")) {
              return;
            }
            setPathFsOpen(false);
          }}
          onConfirm={({
            pathPoints: nextCue,
            objectPathPoints: nextObj,
            cuePathDisplayCurves: nextCueCurves,
            objectPathDisplayCurves: nextObjCurves,
            cuePathCurveNodes: nextCueCurveNodes,
            objectPathCurveNodes: nextObjCurveNodes,
          }) => {
            setPathPoints(nextCue);
            setObjectPathPoints(nextObj);
            setCuePathDisplayCurves(nextCueCurves ?? []);
            setObjectPathDisplayCurves(nextObjCurves ?? []);
            setCuePathCurveNodes(nextCueCurveNodes ?? []);
            setObjectPathCurveNodes(nextObjCurveNodes ?? []);
            setPathFsOpen(false);
          }}
        />
      )}

      <div
        className={
          pathFsOpen && !previewDisabled ? "hidden" : undefined
        }
        aria-hidden={pathFsOpen && !previewDisabled}
      >
        {!previewDisabled && !pathFsOpen && (
          <div
            className="flex flex-col items-stretch gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50 mb-6"
            data-trouble-region={C.region.pathToolbar}
          >
            <p className="text-sm text-site-text">
              경로 편집 화면으로 이동합니다. 두께와 당점 값을 먼저 설정한 뒤 경로를 이어서 편집할 수 있습니다.
            </p>
            <button
              type="button"
              data-testid="trouble-e2e-open-path-fullscreen"
              data-trouble-action={C.action.togglePathMode}
              onClick={openPathFullscreen}
              className="w-full rounded-lg px-3 py-2.5 text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation"
            >
              경로선 편집 다시 열기
            </button>
            <button
              type="button"
              data-trouble-action={C.action.clearAllPaths}
              disabled={pathPoints.length === 0 && objectPathPoints.length === 0}
              onClick={clearCommittedPath}
              className="rounded-lg px-3 py-2 text-sm font-medium border border-red-300 text-red-700 dark:text-red-300 disabled:opacity-50 touch-manipulation"
            >
              저장된 경로 지우기
            </button>
          </div>
        )}

      {/* 4) ?대쾿 ?ㅼ젙: SettingsPanel(紐⑤컮???몃꽕???쒗듃, PC 紐⑤떖)留???援ы삎 ??룹뒳?쇱씠??UI ?쒓굅 */}
      <div
        className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4"
        data-trouble-region={C.region.settings}
        data-solution-settings={JSON.stringify(panelSettings)}
      >
        <p className="text-sm font-medium text-site-text mb-2">해법 설정</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          두께·당점·백/팔로우·레일거리는 설정 패널에서 조절합니다. 경로는 전체화면 하단 설정 버튼에서 수정하세요.
        </p>
        {!previewDisabled && (
          <p className="mt-3 text-[11px] text-gray-500 dark:text-slate-500">
            설정과 경로의 전체화면 편집 패널은 하단에서 열 수 있습니다.
          </p>
        )}
      </div>

      {/* 5) ?댁꽕 ?낅젰 */}
      <div data-trouble-region={C.region.explanation}>
        <label className="block text-sm font-medium text-site-text mb-1">설명</label>
        <textarea
          value={explanationText}
          onChange={(e) => setExplanationText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          placeholder="해법 설명 (두께·당점·경로 의도, 주의점 등)"
        />
      </div>

      {/* 6) 해법 등록 */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        data-trouble-action={C.action.submitSolution}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
      >
        {saving ? "등록 중..." : "해법 등록"}
      </button>
      </div>
    </form>
  );
}

