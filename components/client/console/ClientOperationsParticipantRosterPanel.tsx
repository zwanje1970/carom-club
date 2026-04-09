"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatKoreanDateTime } from "@/lib/format-date";
import {
  ConsoleActionBar,
  ConsoleBadge,
  ConsolePageHeader,
  ConsoleSection,
} from "@/components/client/console/ui";
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
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextBody, consoleTextMuted } from "@/components/client/console/ui/tokens";
import type { ParticipantRosterSummary } from "@/lib/tournament-participant-roster";

export function ClientOperationsParticipantRosterPanel({
  tournamentId,
  listHref,
  operationPhase,
}: {
  tournamentId: string;
  listHref: string;
  operationPhase?: {
    snapshot: TournamentOperationPhaseSnapshot;
    currentView: OperationsPhaseView;
  };
}) {
  const [data, setData] = useState<ParticipantRosterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/participant-roster`);
      const j = await res.json();
      if (!res.ok) {
        setError((j as { error?: string }).error || "불러오지 못했습니다.");
        setData(null);
        return;
      }
      setData(j as ParticipantRosterSummary);
    } catch {
      setError("네트워크 오류");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function promoteAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/participant-roster/promote-waitlist`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) {
        setError((j as { error?: string }).error || "실패");
        return;
      }
      const promoted = (j as { promoted?: number }).promoted ?? 0;
      const lastError = (j as { lastError?: string | null }).lastError;
      if (lastError && promoted === 0) {
        setError(lastError);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function lockRoster() {
    if (
      !confirm(
        "참가 명단을 확정할까요?\n\n· 현재 참가 확정(CONFIRMED)자만 스냅샷에 고정됩니다.\n· 이후 입금확인·취소·반려·대기 승격은 제한됩니다.\n· 기본적으로 대회 상태가 참가 마감(CLOSED)으로 바뀝니다.\n· 대진표 생성 시 스냅샷과 목록이 일치해야 합니다."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/participant-roster/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closeRegistration: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError((j as { error?: string }).error || "확정 실패");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const phaseBlock =
    operationPhase && (
      <OperationsTournamentPhaseStepper
        steps={buildOperationPhaseSteps(tournamentId, operationPhase.snapshot, operationPhase.currentView)}
      />
    );

  if (loading) {
    return (
      <div className="space-y-4">
        {phaseBlock}
        <p className={cx(consoleTextMuted, "py-8 text-center text-sm")}>불러오는 중…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {phaseBlock}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Link href={listHref} className="text-sm text-zinc-700 underline dark:text-zinc-300">
          목록으로
        </Link>
      </div>
    );
  }

  const locked = data.participantRosterLockedAt != null;
  const bracketDone = data.tournamentStatus === "BRACKET_GENERATED";

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="대회 운영"
        title="참가 명단 확정"
        description={`「${data.tournamentName}」`}
      />

      {phaseBlock}

      <OperationsTournamentFlowNav tournamentId={tournamentId} listHref={listHref} active="roster" />
      <OperationsStepFlowBar tournamentId={tournamentId} listHref={listHref} activeStep="roster" />

      {error && (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}

      <ConsoleSection title="확정 전 / 후 상태">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-zinc-200 bg-zinc-50/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">확정 전</p>
            <ul className={cx("mt-2 list-inside list-disc space-y-1", consoleTextMuted)}>
              <li>참가자 표에서 입금확인·반려·취소·대기 승격 가능</li>
              <li>정원·대기 규칙에 따라 CONFIRMED가 바뀔 수 있음</li>
            </ul>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-800 p-3 text-xs text-zinc-100 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900">
            <p className="font-semibold">확정 후</p>
            <ul className="mt-2 list-inside list-disc space-y-1 opacity-95">
              <li>위 참가 처리 API가 잠금(409) — 스냅샷과 불일치 방지</li>
              <li>대회 정원·참가비·OPEN/초안 복귀 수정 불가(클라 PATCH)</li>
              <li>대진표 생성 시 &quot;스냅샷 entryIds&quot;와 현재 CONFIRMED가 일치해야 함</li>
              <li>해제는 플랫폼 DB/관리자 절차(콘솔 UI 미제공)</li>
            </ul>
          </div>
        </div>
      </ConsoleSection>

      <ConsoleSection title="요약">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="총 신청·파이프라인 인원" value={data.totalActiveApplicants} />
          <SummaryCard label="참가 확정자 수" value={data.confirmedCount} />
          <SummaryCard label="대기자 수" value={data.waitingCount} />
          <SummaryCard
            label="중복 의심 인원"
            value={data.duplicateSuspectEntryCount}
            warn={data.duplicateSuspectEntryCount > 0}
          />
          <SummaryCard
            label="미입금확인 신청"
            value={data.appliedPaymentPendingCount}
            hint="확정 전 정리 권장"
            warn={data.appliedPaymentPendingCount > 0}
          />
          <SummaryCard
            label="최종 확정 예정(참고)"
            value={data.projectedConfirmedAfterPromoteAll}
          />
        </div>
        <p className={cx("mt-3 text-[11px]", consoleTextMuted)}>
          정원 {data.maxParticipants != null ? `${data.maxParticipants}명` : "미설정(무제한 취급)"} · 대기 허용{" "}
          {data.useWaiting ? "예" : "아니오"} · 정원 내 전원 승격 시 예상 확정{" "}
          <strong className="text-zinc-800 dark:text-zinc-200">{data.projectedConfirmedAfterPromoteAll}</strong>명
        </p>
      </ConsoleSection>

      {data.duplicateSuspectSamples.length > 0 && (
        <ConsoleSection title="중복 의심 샘플 (입금자명 기준)">
          <ul className="space-y-2 text-xs">
            {data.duplicateSuspectSamples.map((s) => (
              <li key={s.depositorKey} className="rounded-sm border border-amber-200 bg-amber-50/80 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
                <span className="font-medium text-amber-950 dark:text-amber-100">{s.depositorKey}</span>
                <span className="text-zinc-600 dark:text-zinc-400"> — {s.userNames.join(", ")}</span>
              </li>
            ))}
          </ul>
        </ConsoleSection>
      )}

      {locked && data.snapshot && (
        <ConsoleSection title="확정 완료">
          <div className="flex flex-wrap items-center gap-2">
            <ConsoleBadge tone="success">명단 확정됨</ConsoleBadge>
            <span className={cx(consoleTextBody, "text-xs")}>
              {formatKoreanDateTime(data.participantRosterLockedAt!)} · 확정 {data.snapshot.entryIds.length}명
            </span>
          </div>
          <p className={cx("mt-2 text-[11px]", consoleTextMuted)}>
            스냅샷 버전 {data.snapshot.version} · 이후 대진표 엔진은 위 확정자 ID 집합과 DB CONFIRMED 목록 일치를 검사합니다.
          </p>
        </ConsoleSection>
      )}

      {bracketDone && (
        <p className="rounded-sm border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs dark:border-zinc-600 dark:bg-zinc-800">
          대진표가 이미 생성된 대회입니다.
        </p>
      )}

      <ConsoleActionBar
        left={
          <span className={cx(consoleTextMuted, "text-xs")}>
            취소·반려된 신청은 확정 인원에 포함되지 않습니다.
          </span>
        }
        right={
          !locked && !bracketDone ? (
            <>
              <button
                type="button"
                disabled={busy || data.waitingCount === 0}
                className="rounded-sm border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
                onClick={() => void promoteAll()}
              >
                대기자 일괄 승격 (정원 내)
              </button>
              <button
                type="button"
                disabled={busy || data.confirmedCount < 1}
                className="rounded-sm border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                onClick={() => void lockRoster()}
              >
                참가 명단 확정 실행
              </button>
            </>
          ) : null
        }
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: number;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-sm border p-3",
        warn ? "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "border-zinc-200 dark:border-zinc-700"
      )}
    >
      <p className={cx("text-[11px] font-medium text-zinc-500 dark:text-zinc-400")}>{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className={cx("mt-1 text-[10px]", consoleTextMuted)}>{hint}</p>
    </div>
  );
}
