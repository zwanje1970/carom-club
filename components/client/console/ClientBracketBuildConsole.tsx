"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatKoreanDateTime } from "@/lib/format-date";
import {
  ConsoleActionBar,
  ConsoleFormPanel,
  ConsolePageHeader,
  ConsoleSection,
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextBody, consoleTextMuted } from "@/components/client/console/ui/tokens";
import {
  OperationsStepFlowBar,
  OperationsTournamentFlowNav,
} from "@/components/client/console/OperationsTournamentFlowNav";
import { OperationsTournamentPhaseStepper } from "@/components/client/console/OperationsTournamentPhaseStepper";
import {
  buildOperationPhaseSteps,
  type OperationsPhaseView,
  type TournamentOperationPhaseSnapshot,
} from "@/lib/client-tournament-operation-phase";
import {
  computeBracketBuildPlan,
  type BracketBuildGameFormat,
  type BracketBuildInputs,
} from "@/lib/bracket-build-plan";
import {
  simulateBracketBuild,
  type ConfirmedParticipantSlot,
  type SimulationOverallStatus,
} from "@/lib/bracket-build-simulation";

const fieldCls =
  "w-full border border-zinc-400 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100";
const labelCls = "mb-0.5 block text-[11px] font-medium text-zinc-700 dark:text-zinc-300";

export function ClientBracketBuildConsole({
  tournamentId,
  tournamentName,
  tournamentStatus,
  participantRosterLockedAt,
  bracketAlreadyGenerated,
  confirmedParticipantCount,
  confirmedParticipants,
  defaultVenueCount,
  defaultTablesPerVenue,
  listHref,
  operationPhase,
}: {
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: string;
  participantRosterLockedAt: string | null;
  bracketAlreadyGenerated: boolean;
  confirmedParticipantCount: number;
  /** 확정 엔트리 스냅샷 — 시뮬레이션·부수 검증용 */
  confirmedParticipants: ConfirmedParticipantSlot[];
  defaultVenueCount: number;
  defaultTablesPerVenue: number;
  listHref: string;
  operationPhase?: {
    snapshot: TournamentOperationPhaseSnapshot;
    currentView: OperationsPhaseView;
  };
}) {
  const [gameFormat, setGameFormat] = useState<BracketBuildGameFormat>("single_elim_tournament");
  const [venueCount, setVenueCount] = useState(String(defaultVenueCount));
  const [tablesPerVenue, setTablesPerVenue] = useState(String(defaultTablesPerVenue));
  const [baseMatchDurationMinutes, setBaseMatchDurationMinutes] = useState("25");
  const [turnoverMinutesBetweenRounds, setTurnoverMinutesBetweenRounds] = useState("5");
  const [divisionTimeRulesNotes, setDivisionTimeRulesNotes] = useState("");
  const [separateByDivision, setSeparateByDivision] = useState(false);
  const [exceptionAllowanceCount, setExceptionAllowanceCount] = useState("0");
  const [scheduleStartLocal, setScheduleStartLocal] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (d.getMinutes() % 5), 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const plan = useMemo(() => {
    const v = Math.max(0, parseInt(venueCount, 10) || 0);
    const t = Math.max(0, parseInt(tablesPerVenue, 10) || 0);
    const base = Math.max(0, parseInt(baseMatchDurationMinutes, 10) || 0);
    const turnover = Math.max(0, parseInt(turnoverMinutesBetweenRounds, 10) || 0);
    const allowance = Math.max(0, parseInt(exceptionAllowanceCount, 10) || 0);
    const start = new Date(scheduleStartLocal);

    const inputs: BracketBuildInputs = {
      confirmedParticipantCount,
      gameFormat,
      venueCount: v,
      tablesPerVenue: t,
      baseMatchDurationMinutes: base,
      turnoverMinutesBetweenRounds: turnover,
      divisionTimeRulesNotes,
      separateByDivision,
      exceptionAllowanceCount: allowance,
      scheduleStartAt: start,
    };
    return computeBracketBuildPlan(inputs);
  }, [
    confirmedParticipantCount,
    gameFormat,
    venueCount,
    tablesPerVenue,
    baseMatchDurationMinutes,
    turnoverMinutesBetweenRounds,
    divisionTimeRulesNotes,
    separateByDivision,
    exceptionAllowanceCount,
    scheduleStartLocal,
  ]);

  const simulation = useMemo(() => {
    const v = Math.max(0, parseInt(venueCount, 10) || 0);
    const t = Math.max(0, parseInt(tablesPerVenue, 10) || 0);
    const base = Math.max(0, parseInt(baseMatchDurationMinutes, 10) || 0);
    const turnover = Math.max(0, parseInt(turnoverMinutesBetweenRounds, 10) || 0);
    const allowance = Math.max(0, parseInt(exceptionAllowanceCount, 10) || 0);
    const start = new Date(scheduleStartLocal);

    const inputs: BracketBuildInputs = {
      confirmedParticipantCount,
      gameFormat,
      venueCount: v,
      tablesPerVenue: t,
      baseMatchDurationMinutes: base,
      turnoverMinutesBetweenRounds: turnover,
      divisionTimeRulesNotes,
      separateByDivision,
      exceptionAllowanceCount: allowance,
      scheduleStartAt: start,
    };
    return simulateBracketBuild(inputs, confirmedParticipants);
  }, [
    confirmedParticipantCount,
    confirmedParticipants,
    gameFormat,
    venueCount,
    tablesPerVenue,
    baseMatchDurationMinutes,
    turnoverMinutesBetweenRounds,
    divisionTimeRulesNotes,
    separateByDivision,
    exceptionAllowanceCount,
    scheduleStartLocal,
  ]);

  const rosterLocked = participantRosterLockedAt != null;
  const closed = tournamentStatus === "CLOSED";
  const simulationAllowsGenerate = simulation.overallStatus !== "IMPOSSIBLE";
  const serverGenerateLikely =
    plan.planComputationOk &&
    simulationAllowsGenerate &&
    !bracketAlreadyGenerated &&
    rosterLocked &&
    closed &&
    confirmedParticipantCount >= 2;

  const statusBadgeClass = (s: SimulationOverallStatus) =>
    s === "OK"
      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100"
      : s === "WARNING"
        ? "border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-red-600 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100";

  const statusLabel = (s: SimulationOverallStatus) =>
    s === "OK" ? "정상" : s === "WARNING" ? "주의" : "생성 불가";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ConsolePageHeader
        eyebrow="대회 운영"
        title="대진 생성 콘솔"
        description={`「${tournamentName}」`}
      />
      {operationPhase && (
        <OperationsTournamentPhaseStepper
          steps={buildOperationPhaseSteps(tournamentId, operationPhase.snapshot, operationPhase.currentView)}
        />
      )}
      <OperationsTournamentFlowNav tournamentId={tournamentId} listHref={listHref} active="bracket-build" />
      <OperationsStepFlowBar tournamentId={tournamentId} listHref={listHref} activeStep="bracket-build" />

      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <ConsoleFormPanel
          title="변수 입력"
        >
          <div>
            <label className={labelCls}>확정 참가자 수 (DB)</label>
            <input type="text" readOnly className={cx(fieldCls, "bg-zinc-100 dark:bg-zinc-900")} value={`${confirmedParticipantCount}명`} />
            <p className={cx("mt-1 text-[10px]", consoleTextMuted)}>TournamentEntry.status = CONFIRMED</p>
          </div>

          <div>
            <label className={labelCls}>경기 방식</label>
            <select
              className={fieldCls}
              value={gameFormat}
              onChange={(e) => setGameFormat(e.target.value as BracketBuildGameFormat)}
            >
              <option value="single_elim_tournament">단판 토너먼트 (싱글 엘리미네이션)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>경기장 수</label>
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={venueCount}
                onChange={(e) => setVenueCount(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>경기장당 테이블 수</label>
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={tablesPerVenue}
                onChange={(e) => setTablesPerVenue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>기준 경기시간(분)</label>
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={baseMatchDurationMinutes}
                onChange={(e) => setBaseMatchDurationMinutes(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>라운드 간 버퍼(분)</label>
              <input
                type="number"
                min={0}
                className={fieldCls}
                value={turnoverMinutesBetweenRounds}
                onChange={(e) => setTurnoverMinutesBetweenRounds(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>부수별 시간 규칙 (메모)</label>
            <textarea
              rows={3}
              className={fieldCls}
              placeholder="예: 오픈부 30분 / 일반부 25분 — 추후 규칙 엔진에 매핑"
              value={divisionTimeRulesNotes}
              onChange={(e) => setDivisionTimeRulesNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="sepDiv"
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-zinc-500"
              checked={separateByDivision}
              onChange={(e) => setSeparateByDivision(e.target.checked)}
            />
            <label htmlFor="sepDiv" className="text-[11px] text-zinc-800 dark:text-zinc-200">
              부수 분리 옵션 (병렬 슬롯 1/2 가정)
            </label>
          </div>

          <div>
            <label className={labelCls}>예외 허용(동시 슬롯 여유)</label>
            <input
              type="number"
              min={0}
              className={fieldCls}
              value={exceptionAllowanceCount}
              onChange={(e) => setExceptionAllowanceCount(e.target.value)}
            />
            <p className={cx("mt-1 text-[10px]", consoleTextMuted)}>전체 동시 처리 능력에 가산되는 정수 슬롯</p>
          </div>

          <div>
            <label className={labelCls}>시작 시간</label>
            <input
              type="datetime-local"
              className={fieldCls}
              value={scheduleStartLocal}
              onChange={(e) => setScheduleStartLocal(e.target.value)}
            />
          </div>
        </ConsoleFormPanel>

        <div className="space-y-3">
          <ConsoleSection title="미리보기 · 검증 (단판 토너먼트)" flush>
            <div className="border-b border-zinc-300 p-2 dark:border-zinc-600">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    "inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold",
                    statusBadgeClass(simulation.overallStatus)
                  )}
                >
                  {statusLabel(simulation.overallStatus)}
                </span>
                <span className="text-[11px] text-zinc-700 dark:text-zinc-300">{simulation.summaryMessage}</span>
              </div>
              <table className="w-full border-collapse text-left text-[11px] text-zinc-800 dark:text-zinc-200">
                <tbody>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">총 경기 수</th>
                    <td className="py-1 tabular-nums">{simulation.totalMatches}경기</td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">브래킷 슬롯 / 부전승</th>
                    <td className="py-1 tabular-nums">
                      {simulation.bracketSlotSize}슬롯 · 부전승 {simulation.byeCount}
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">예상 소요(분)</th>
                    <td className="py-1 tabular-nums">{simulation.globalEndMinutesFromStart}분</td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">전체 종료 예상</th>
                    <td className="py-1">{formatKoreanDateTime(simulation.globalEndAt.toISOString())}</td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">경기장 종료 시각 편차</th>
                    <td className="py-1 tabular-nums">약 {Math.round(simulation.venueFinishTimeSpreadMinutes)}분</td>
                  </tr>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-2 font-semibold text-zinc-600 dark:text-zinc-400">동시 처리(원천/유효)</th>
                    <td className="py-1 tabular-nums">
                      {plan.parallelCapacityRaw} → {simulation.parallelCapacityEffective} 슬롯/배치
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1 pr-2 align-top font-semibold text-zinc-600 dark:text-zinc-400">서버 생성 힌트</th>
                    <td className="py-1">
                      <span
                        className={
                          serverGenerateLikely
                            ? "font-medium text-emerald-800 dark:text-emerald-300"
                            : "font-medium text-amber-900 dark:text-amber-200"
                        }
                      >
                        {serverGenerateLikely ? "조건 충족(실행 전 최종 확인)" : "조건 미충족 / 검토 필요"}
                      </span>
                      <ul className={cx("mt-1 list-inside list-disc text-[10px]", consoleTextMuted)}>
                        <li>시뮬레이션: {statusLabel(simulation.overallStatus)}</li>
                        <li>단순 계획: {plan.planComputationOk ? "정상" : "오류 있음"}</li>
                        <li>명단 확정: {rosterLocked ? "완료" : "미완료"}</li>
                        <li>대회 상태: {tournamentStatus} (생성 API는 보통 CLOSED 필요)</li>
                        <li>기존 대진: {bracketAlreadyGenerated ? "있음" : "없음"}</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {simulation.validations.filter((x) => x.severity === "block").length > 0 && (
              <div className="border-b border-red-300 bg-red-50 p-2 text-[11px] text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                <p className="font-semibold">차단 (생성 불가 요인)</p>
                <ul className="mt-1 list-inside list-disc">
                  {simulation.validations
                    .filter((x) => x.severity === "block")
                    .map((e, i) => (
                      <li key={`b-${i}`}>{e.message}</li>
                    ))}
                </ul>
              </div>
            )}

            {simulation.validations.filter((x) => x.severity === "warn").length > 0 && (
              <div className="border-b border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">주의</p>
                <ul className="mt-1 list-inside list-disc">
                  {simulation.validations
                    .filter((x) => x.severity === "warn")
                    .map((e, i) => (
                      <li key={`w-${i}`}>{e.message}</li>
                    ))}
                </ul>
              </div>
            )}

            {simulation.validations.filter((x) => x.severity === "info").length > 0 && (
              <div className="border-b border-zinc-300 bg-zinc-50 p-2 text-[11px] text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200">
                <p className="font-semibold">안내</p>
                <ul className="mt-1 list-inside list-disc">
                  {simulation.validations
                    .filter((x) => x.severity === "info")
                    .map((e, i) => (
                      <li key={`n-${i}`}>{e.message}</li>
                    ))}
                </ul>
              </div>
            )}

            {plan.errors.length > 0 && (
              <div className="border-b border-red-300 bg-red-50 p-2 text-[11px] text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                <p className="font-semibold">입력 오류 (단순 계획)</p>
                <ul className="mt-1 list-inside list-disc">
                  {plan.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.warnings.length > 0 && (
              <div className="border-b border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">단순 계획 경고</p>
                <ul className="mt-1 list-inside list-disc">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-2">
              <p className={cx("mb-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300")}>
                라운드별 소요 (배치·웨이브 반영)
              </p>
              <ConsoleTable embedded>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>라운드</ConsoleTableTh>
                    <ConsoleTableTh>합계(분)</ConsoleTableTh>
                  </ConsoleTableRow>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {simulation.roundWallMinutes.length === 0 ? (
                    <ConsoleTableRow>
                      <ConsoleTableTd colSpan={2} className="text-zinc-500">
                        조건 미충족으로 산출 없음
                      </ConsoleTableTd>
                    </ConsoleTableRow>
                  ) : (
                    simulation.roundWallMinutes.map((m, idx) => (
                      <ConsoleTableRow key={idx}>
                        <ConsoleTableTd>{idx + 1}</ConsoleTableTd>
                        <ConsoleTableTd className="tabular-nums">{m}</ConsoleTableTd>
                      </ConsoleTableRow>
                    ))
                  )}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>

            <div className="p-2">
              <p className={cx("mb-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300")}>
                경기장별 배정·종료 예상
              </p>
              <ConsoleTable embedded>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>#</ConsoleTableTh>
                    <ConsoleTableTh>배정 경기 수</ConsoleTableTh>
                    <ConsoleTableTh>시작 기준 종료(분)</ConsoleTableTh>
                  </ConsoleTableRow>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {simulation.venueSummaries.length === 0 ? (
                    <ConsoleTableRow>
                      <ConsoleTableTd colSpan={3} className="text-zinc-500">
                        산출 없음
                      </ConsoleTableTd>
                    </ConsoleTableRow>
                  ) : (
                    simulation.venueSummaries.map((v) => (
                      <ConsoleTableRow key={v.venueIndex}>
                        <ConsoleTableTd className="tabular-nums">{v.venueIndex}</ConsoleTableTd>
                        <ConsoleTableTd className="tabular-nums">{v.totalMatchesAssigned}</ConsoleTableTd>
                        <ConsoleTableTd className="tabular-nums">{v.endMinutesFromStart}</ConsoleTableTd>
                      </ConsoleTableRow>
                    ))
                  )}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>

            <div className="p-2">
              <p className={cx("mb-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300")}>
                배치 상세 (경기장별 경기 수·동일 부 동시)
              </p>
              <div className="max-h-48 overflow-auto rounded border border-zinc-300 text-[10px] dark:border-zinc-600">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">R</th>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">배치</th>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">경기</th>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">k/장</th>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">분</th>
                      <th className="border-b border-zinc-300 px-1 py-0.5 dark:border-zinc-600">동일부(1R)</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-800 dark:text-zinc-200">
                    {simulation.venueBatchDetails.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-1 py-1 text-zinc-500">
                          없음
                        </td>
                      </tr>
                    ) : (
                      simulation.venueBatchDetails.map((b, i) => (
                        <tr key={i} className="border-b border-zinc-200 dark:border-zinc-700">
                          <td className="px-1 py-0.5 tabular-nums">{b.roundIndex + 1}</td>
                          <td className="px-1 py-0.5 tabular-nums">{b.batchIndexInRound + 1}</td>
                          <td className="px-1 py-0.5 tabular-nums">{b.matchesInBatch}</td>
                          <td className="px-1 py-0.5 font-mono text-[9px]">[{b.kPerVenue.join(",")}]</td>
                          <td className="px-1 py-0.5 tabular-nums">{b.batchWallMinutes}</td>
                          <td className="px-1 py-0.5 font-mono text-[9px]">
                            {b.sameDivisionSimultaneousPerVenue
                              ? `[${b.sameDivisionSimultaneousPerVenue.join(",")}]`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ConsoleSection>

          <ConsoleSection title="연동 메모" plain>
            <p className={cx(consoleTextBody, "text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400")}>
              입력값은 <code className="text-zinc-800 dark:text-zinc-200">BracketBuildInputs</code>로 직렬화 가능합니다. 우측 수치는{" "}
              <code className="text-zinc-800 dark:text-zinc-200">simulateBracketBuild</code>(경기장·웨이브·1R 부수 배치) 미리보기이며
              Match 저장 전 단계입니다. 단순 합산은 <code className="text-zinc-800 dark:text-zinc-200">computeBracketBuildPlan</code>과
              병행 표시됩니다.
            </p>
          </ConsoleSection>
        </div>
      </div>

      <ConsoleActionBar
        sticky
        className="mt-auto"
        left={
          <span className={cx(consoleTextMuted, "text-[11px]")}>
            tournamentId: <code className="text-zinc-700 dark:text-zinc-300">{tournamentId}</code>
          </span>
        }
        right={
          <Link
            href={`/client/operations/tournaments/${tournamentId}/bracket`}
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-4 text-xs font-semibold text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            대진표 보기·수정으로 이동
          </Link>
        }
      />
    </div>
  );
}
