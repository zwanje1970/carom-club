"use client";

/**
 * 而ㅻ??덊떚 ?뚮궃援с?寃뚯떆???대쾿 ?몄쭛湲?(`/community/nangu/.../solution/new`).
 * ?쒓뎄?닿껐??trouble)??`TroubleSolutionEditor` ??濡ㅼ븘???쒖꽌쨌?댁떇 ?먯튃: docs/NANGU_SOLUTION_ROLLOUT.md
 * - ?먮낯 怨듬같移? ?쎄린 ?꾩슜
 * - ?대쾿: ?먭퍡쨌?뱀젏쨌諛깆뒪?몃줈??룻뙏濡쒖슦쨌蹂쇱뒪?쇰뱶쨌吏꾪뻾寃쎈줈쨌?댁꽕 蹂꾨룄 state
 * - ?먮룞 臾쇰━ 怨꾩궛 ?놁쓬, ?ъ슜???섎룞 議곗옉留? * - ?섎룎由ш린: 吏곸쟾 ?몄쭛 ?ㅻ깄?룹쑝濡?蹂듭썝 (理쒕? NANGU_SOLUTION_EDITOR_MAX_UNDO ?④퀎)
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  DEFAULT_SOLUTION_SETTINGS,
  clampSolutionSettings,
  mergeSolutionSettings,
  type SolutionSettingsValue,
} from "@/lib/solution-settings-panel-value";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  getPlayfieldRect,
} from "@/lib/billiard-table-constants";
import {
  computeCueBallNormFromPanelSettings,
  panelThicknessFromMainThicknessOffset,
  thicknessOffsetXFromThicknessStep,
} from "@/lib/solution-panel-ball-layout";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { NanguReadOnlyLayout } from "./NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "./NanguSolutionPathOverlay";
import {
  ballSpeedToLegacySpeed,
  ballSpeedToLegacySpeedLevel,
  ballSpeedToRailCount,
  normalizeBallSpeed,
} from "@/lib/ball-speed-constants";
import { SolutionPathEditorFullscreen } from "./SolutionPathEditorFullscreen";
import { NanguTablePreviewHitLayer } from "./NanguTablePreviewHitLayer";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import {
  createInitialNanguSnapshotFromEditorProps,
  resolvePanelSettingsAndAuthority,
} from "@/lib/solution-editor-hydrate";
import {
  type NanguSolutionEditorUndoSnapshot,
  cloneNanguSolutionEditorSnapshot,
  NANGU_SOLUTION_EDITOR_MAX_UNDO,
  type NanguActivePanel,
} from "@/lib/nangu-solution-editor-undo";

export type { NanguActivePanel };

export interface NanguSolutionEditorProps {
  ballPlacement: NanguBallPlacement;
  postTitle: string;
  postContent: string;
  /** ??λ맂 ?대쾿 JSON ??硫붿씤쨌?⑤꼸쨌寃쎈줈쨌?댁꽕 ?쇨큵 蹂듭썝 */
  initialSolutionData?: Partial<NanguSolutionData> | null;
  /** `initialSolutionData.settings`留??곕줈 ?섍만 ???덇굅?? */
  initialPersistedSettings?: SolutionSettingsValue | null;
  onSubmit: (payload: {
    title?: string | null;
    comment?: string | null;
    data: NanguSolutionData;
  }) => Promise<void>;
}

export function NanguSolutionEditor({
  ballPlacement,
  postTitle,
  postContent,
  initialSolutionData = null,
  initialPersistedSettings = null,
  onSubmit,
}: NanguSolutionEditorProps) {
  const [editor, setEditor] = useState<NanguSolutionEditorUndoSnapshot>(() =>
    createInitialNanguSnapshotFromEditorProps(initialSolutionData, initialPersistedSettings)
  );
  const [undoStack, setUndoStack] = useState<NanguSolutionEditorUndoSnapshot[]>([]);

  const commit = useCallback(
    (updater: (prev: NanguSolutionEditorUndoSnapshot) => NanguSolutionEditorUndoSnapshot) => {
      setEditor((prev) => {
        setUndoStack((stack) => [
          ...stack.slice(-(NANGU_SOLUTION_EDITOR_MAX_UNDO - 1)),
          cloneNanguSolutionEditorSnapshot(prev),
        ]);
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const top = stack[stack.length - 1]!;
      setEditor(cloneNanguSolutionEditorSnapshot(top));
      return stack.slice(0, -1);
    });
  }, []);

  const canUndo = undoStack.length > 0;

  const {
    activePanel,
    isBankShot,
    thicknessOffsetX,
    spinX,
    spinY,
    backstrokeLevel,
    followStrokeLevel,
    ballSpeed,
    pathPoints,
    cuePathCurveNodes,
    objectPathCurveNodes,
    explanationText,
  } = editor;

  /** 吏꾩엯 ??怨㏓컮濡?寃쎈줈???꾩껜?붾㈃(?쒓뎄?대쾿 ?쒖떆 1???숈꽑). ?ㅽ뙚쨌以뙿룹옱?앹? ??紐⑤뱶?먯꽌留?*/
  const [fullScreenEditMode, setFullScreenEditMode] = useState(true);
  const [pathFsKey, setPathFsKey] = useState(0);
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
  const [panelSettings, setPanelSettings] = useState<SolutionSettingsValue>(() =>
    resolvePanelSettingsAndAuthority(initialSolutionData, initialPersistedSettings).settings
  );

  const openSettingsPanel = useCallback(
    (section?: "thickness" | "tip" | "rail") => {
      setSettingsFocusSection(section ?? null);
      setPanelSettings((prev) => {
        /** 에디터 동기화 병합이 덮어쓰지 않도록, 열기 직전 사용자 선택 유지 */
        const preserveIgnorePhysics = prev.ignorePhysics;
        const base = {
          ballSpeed: editor.ballSpeed,
          backstroke: editor.backstrokeLevel,
          followStroke: editor.followStrokeLevel,
        };
        let merged: SolutionSettingsValue;
        if (!settingsPanelBallSpeedAuthoritative) {
          merged = clampSolutionSettings(
            mergeSolutionSettings(
              {
                ...base,
                railCount: ballSpeedToRailCount(editor.ballSpeed),
                ...panelThicknessFromMainThicknessOffset(editor.thicknessOffsetX),
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
      editor.ballSpeed,
      editor.backstrokeLevel,
      editor.followStrokeLevel,
      editor.thicknessOffsetX,
    ]
  );

  const previewOrientation = useTableOrientation();

  const rectLandscape = useMemo(
    () => getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    []
  );

  const cueBallNormFromPanel = useMemo(
    () => computeCueBallNormFromPanelSettings(ballPlacement.redBall, panelSettings, rectLandscape),
    [ballPlacement.redBall, panelSettings, rectLandscape]
  );

  const cueBallNormForDisplay = useMemo(() => {
    if (!settingsPanelBallSpeedAuthoritative) {
      return ballPlacement.cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;
    }
    return cueBallNormFromPanel;
  }, [settingsPanelBallSpeedAuthoritative, ballPlacement, cueBallNormFromPanel]);

  const ballNormOverridesForPanel = useMemo(() => {
    /** ?쒖떆???섍뎄 ?ㅻ쾭?쇱씠?쒕뒗 ?ㅼ젙李쎌씠 ?대┛ ?숈븞?먮쭔 ?곸슜 (?좊땲硫붿씠??醫뚰몴 濡쒖쭅怨?遺꾨━) */
    if (!settingsPanelBallSpeedAuthoritative || !settingsPanelOpen) return undefined;
    const k = ballPlacement.cueBall === "yellow" ? "yellow" : "white";
    return { [k]: cueBallNormFromPanel } as Partial<
      Record<"red" | "yellow" | "white", { x: number; y: number }>
    >;
  }, [settingsPanelBallSpeedAuthoritative, settingsPanelOpen, ballPlacement.cueBall, cueBallNormFromPanel]);

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

  const closeFullScreenEdit = useCallback(() => {
    setFullScreenEditMode(false);
  }, []);

  /** 誘몃━蹂닿린 ??踰꾪듉: ?쒓뎄?명듃 怨듬같移섏? ?숈씪???꾩껜?붾㈃ ?몃줈 寃쎈줈 ?몄쭛 */
  const enterFullScreenEdit = useCallback(() => {
    setPathFsKey((k) => k + 1);
    setFullScreenEditMode(true);
  }, []);

  const clearCommittedPath = useCallback(() => {
    commit((prev) => ({
      ...prev,
      pathPoints: [],
      cuePathCurveNodes: [],
      objectPathCurveNodes: [],
    }));
  }, [commit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath =
        pathPoints.length >= 1 ? pathPoints.map((p) => ({ x: p.x, y: p.y })) : [];
      await onSubmit({
        title: null,
        comment: explanationText.trim() || null,
        data: {
          isBankShot,
          thicknessOffsetX: isBankShot ? undefined : effectiveThicknessOffsetX,
          tipX: spinX,
          tipY: spinY,
          spinX,
          spinY,
          paths: pointsForPath.length >= 1 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
          backstrokeLevel,
          followStrokeLevel,
          ballSpeed: effectiveBallSpeed,
          speedLevel: ballSpeedToLegacySpeedLevel(effectiveBallSpeed),
          speed: ballSpeedToLegacySpeed(effectiveBallSpeed),
          explanationText: explanationText.trim() || undefined,
          cuePathCurveNodes: cuePathCurveNodes.length > 0 ? cuePathCurveNodes : undefined,
          objectPathCurveNodes:
            objectPathCurveNodes.length > 0 ? objectPathCurveNodes : undefined,
          settings: settingsPanelBallSpeedAuthoritative
            ? clampSolutionSettings(panelSettings)
            : undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. ?곷떒 ?뺣낫 ?곸뿭 */}
      <div>
        <h2 className="text-lg font-semibold text-site-text">{postTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{postContent}</p>
      </div>

      {fullScreenEditMode && (
        <SolutionPathEditorFullscreen
          key={pathFsKey}
          variant="nangu"
          presentation="noteBallPlacementFullscreen"
          ballPlacement={ballPlacement}
          panelBallNormOverrides={ballNormOverridesForPanel}
          panelCueTipNorm={
            settingsPanelBallSpeedAuthoritative ? panelSettings.tipNorm : null
          }
          initialPathPoints={pathPoints}
          initialObjectPathPoints={[]}
          initialCuePathCurveNodes={cuePathCurveNodes}
          initialObjectPathCurveNodes={objectPathCurveNodes}
          thicknessOffsetX={effectiveThicknessOffsetX}
          isBankShot={isBankShot}
          ballSpeed={effectiveBallSpeed}
          settingsValue={panelSettings}
          onSettingsChange={(next) => {
            setSettingsPanelBallSpeedAuthoritative(true);
            setPanelSettings(next);
            if (next.railCount != null && !Number.isNaN(Number(next.railCount))) {
              commit((prev) => ({ ...prev, ballSpeed: normalizeBallSpeed(next.railCount) }));
            }
          }}
          settingsOpen={settingsPanelOpen}
          onSettingsOpen={openSettingsPanel}
          onSettingsClose={() => {
            setSettingsPanelOpen(false);
            setSettingsFocusSection(null);
          }}
          settingsFocusSection={settingsFocusSection}
          onCancel={closeFullScreenEdit}
          onConfirm={({
            pathPoints: next,
            cuePathCurveNodes: nextCueCurveNodes,
            objectPathCurveNodes: nextObjCurveNodes,
          }) => {
            commit((prev) => ({
              ...prev,
              pathPoints: next,
              cuePathCurveNodes: nextCueCurveNodes ?? [],
              objectPathCurveNodes: nextObjCurveNodes ?? [],
            }));
            closeFullScreenEdit();
          }}
        />
      )}

      <div
        className={fullScreenEditMode ? "hidden" : undefined}
        aria-hidden={fullScreenEditMode}
      >
      {/* 2. ?쒓뎄?명듃 怨듬같移섏? ?숈씪 醫뚰몴 誘몃━蹂닿린 ???꾩껜?붾㈃ 醫낅즺 ?꾩뿉留??쒖떆(??쑝濡??ㅼ떆 ?닿린 媛?? */}
      <div className="flex w-full flex-col items-center">
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
          {/* 罹붾쾭?ㅒ톁VG???ъ씤???듦낵 ???덊듃 ?덉씠?대쭔 ???섏떊 */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0">
              <NanguReadOnlyLayout
                ballPlacement={ballPlacement}
                ballNormOverrides={ballNormOverridesForPanel}
                cueTipNorm={
                  settingsPanelBallSpeedAuthoritative ? panelSettings.tipNorm : null
                }
                fillContainer
                embedFill
                className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                showGrid
                drawStyle="realistic"
                showCueBallSpot
                orientation={previewOrientation}
                betweenTableAndBallsLayer={
                  <NanguSolutionPathOverlay
                    pathPoints={pathPoints}
                    cuePos={cueBallNormForDisplay}
                    tableBallPlacement={ballPlacement}
                    objectPathPoints={[]}
                    cuePathCurveNodes={cuePathCurveNodes}
                    orientation={previewOrientation}
                    pathMode={false}
                    objectPathMode={false}
                    pathLinesVisible={true}
                    ballPickLayout={ballPlacement}
                    ballNormOverrides={ballNormOverridesForPanel}
                  />
                }
              />
            </div>
          </div>
          <NanguTablePreviewHitLayer
            className="absolute inset-0 z-[3] cursor-pointer touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-site-primary rounded-lg"
            onOpen={enterFullScreenEdit}
            ariaLabel="전체화면에서 경로 편집 열기"
          />
        </div>
        <div
          className="mx-auto mt-2 flex w-full max-w-full flex-wrap items-center justify-center gap-2"
          style={{ maxWidth: DEFAULT_TABLE_WIDTH }}
        >
          <button
            type="button"
            onClick={() => enterFullScreenEdit()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation"
          >
            전체화면 · 경로선 편집
          </button>
          <button
            type="button"
            disabled={pathPoints.length === 0}
            onClick={clearCommittedPath}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 dark:text-red-300 disabled:opacity-50 touch-manipulation"
          >
            저장된 경로 지우기
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            수구 경로 스팟 {pathPoints.length}개
            {pathPoints.length >= 1 ? " · 수구 경로 있음" : ""}
          </span>
        </div>
      </div>

      {/* 3. ?ㅼ젙: SettingsPanel(紐⑤컮???몃꽕???쒗듃, PC 紐⑤떖)留??ъ슜 ??援ы삎 ??룹뒳?쇱씠??UI ?쒓굅 */}
      <div
        className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4"
        data-solution-settings={JSON.stringify(panelSettings)}
      >
        <p className="text-sm font-medium text-site-text mb-2">해법 설정</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          두께·당점·백/팔로우·레일거리는 설정 패널에서 조절합니다. 경로는 전체화면 하단 설정 버튼에서 수정하세요.
        </p>
        <p className="mt-3 text-[11px] text-gray-500 dark:text-slate-500">
          설정과 전체화면 경로 편집 패널은 하단에서 열 수 있습니다.
        </p>
      </div>

      {/* 4. ?댁꽕 ?낅젰 */}
      <div>
        <label className="block text-sm font-medium text-site-text mb-1">설명</label>
        <textarea
          value={explanationText}
          onChange={(e) => commit((prev) => ({ ...prev, explanationText: e.target.value }))}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          placeholder="해법 설명을 입력하세요. (두께·당점·경로 의도, 주의점 등)"
        />
      </div>

      {/* 5. ?쒖텧 */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
        <button
          type="button"
          disabled={!canUndo || saving}
          onClick={handleUndo}
          title={`직전 편집 상태로 되돌립니다. (최대 ${NANGU_SOLUTION_EDITOR_MAX_UNDO}단계)`}
          className="sm:w-40 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text font-medium disabled:opacity-45 disabled:pointer-events-none hover:bg-gray-50 dark:hover:bg-slate-700 touch-manipulation"
        >
          되돌리기
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 min-h-[3rem] py-3 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50 touch-manipulation"
        >
          {saving ? "저장 중..." : "해법 등록"}
        </button>
      </div>
      </div>
    </form>
  );
}

