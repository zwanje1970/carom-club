"use client";

import Link from "next/link";
import { sanitizeImageSrc } from "@/lib/image-src";
import { formatKoreanSchedule } from "@/lib/format-date";

const GAME_FORMAT_LABEL: Record<string, string> = {
  TOURNAMENT: "토너먼트",
  SCOTCH: "스카치",
  SURVIVAL: "서바이벌",
  FOUR_BALL: "4구대회",
};

export type TournamentPromoBlockProps = {
  tournamentId: string;
  name: string;
  posterImageUrl: string | null;
  summary: string | null;
  entryFee: number | null;
  prizeInfo: string | null;
  gameFormat: string | null;
  entryCondition: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  venue: string | null;
  matchVenues?: Array<{ displayLabel: string; venueName?: string | null; address?: string | null; phone?: string | null }>;
  tournamentVenues?: Array<{ id: string; name: string; slug: string }>;
  maxParticipants: number | null;
  confirmedCount: number;
  useWaiting: boolean;
  status: string;
  isLoggedIn: boolean;
  canApply: boolean;
  alreadyApplied: boolean;
  applyClosedReason: string | null;
};

export function TournamentPromoBlock({
  tournamentId,
  name,
  posterImageUrl,
  summary,
  entryFee,
  prizeInfo,
  gameFormat,
  entryCondition,
  startAt,
  endAt,
  venue,
  matchVenues,
  tournamentVenues,
  maxParticipants,
  confirmedCount,
  useWaiting,
  status,
  isLoggedIn,
  canApply,
  alreadyApplied,
  applyClosedReason,
}: TournamentPromoBlockProps) {
  const max = maxParticipants ?? 0;
  const remaining = max > 0 ? Math.max(0, max - confirmedCount) : null;
  const ratio = max > 0 ? confirmedCount / max : 0;
  const almostFull = remaining !== null && remaining > 0 && remaining <= 3;
  const isFull = remaining !== null && remaining <= 0;
  const nearlyFull = max > 0 && ratio >= 0.8;

  let statusBadge: string | null = null;
  if (status === "CLOSED" || status === "FINISHED") statusBadge = status === "FINISHED" ? "종료" : "참가 마감";
  else if (isFull && useWaiting) statusBadge = "대기자 등록 가능";
  else if (isFull && !useWaiting) statusBadge = "정원 마감";
  else if (almostFull) statusBadge = `마지막 ${remaining}자리`;
  else if (nearlyFull) statusBadge = "마감임박";

  return (
    <article className="space-y-6">
      {/* Hero: 대표 이미지 + 제목 */}
      <div className="rounded-xl overflow-hidden bg-site-card border border-site-border">
        {(() => {
          const safeSrc = sanitizeImageSrc(posterImageUrl ?? "");
          if (!safeSrc) {
            return (
              <div className="w-full aspect-[2/1] bg-site-bg flex items-center justify-center text-site-text-muted text-sm">
                대표 이미지 없음
              </div>
            );
          }
          return (
            <div className="relative w-full aspect-[2/1] bg-site-bg flex items-center justify-center">
              <img
                src={safeSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-contain min-h-[80px]"
                data-debug-src={safeSrc}
              />
            </div>
          );
        })()}
        <div className="p-4 sm:p-5">
          <h1 className="text-xl sm:text-2xl font-bold text-site-text">{name}</h1>
          {summary && <p className="mt-2 text-site-text-muted text-sm sm:text-base leading-relaxed">{summary}</p>}
        </div>
      </div>

      {/* 참가자 현황: 항상 표시 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-site-text mb-3">참가자 현황</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-site-text font-medium">
            {max > 0 ? (
              <>
                <span className="text-site-primary">{confirmedCount}명</span> / {max}명
                {remaining !== null && remaining > 0 && (
                  <span className="text-site-text-muted text-sm ml-1">(남은 자리 {remaining}석)</span>
                )}
              </>
            ) : (
              <span className="text-site-primary">{confirmedCount}명</span>
            )}
          </span>
          {statusBadge && (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusBadge === "마감임박" || statusBadge.startsWith("마지막")
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  : statusBadge === "대기자 등록 가능"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                    : "bg-site-bg text-site-text-muted"
              }`}
            >
              {statusBadge}
            </span>
          )}
        </div>
        {/* 참가 신청 CTA */}
        <div className="mt-4">
          {alreadyApplied && (
            <p className="text-sm text-site-text-muted">이미 참가 신청하셨습니다. 아래 참가자 명단에서 확인할 수 있습니다.</p>
          )}
          {canApply && !alreadyApplied && !isLoggedIn && (
            <p className="text-sm text-site-text-muted">
              <Link href={`/login?next=/tournaments/${tournamentId}/apply`} className="text-site-primary hover:underline font-medium">
                로그인
              </Link>
              후 참가 신청할 수 있습니다.
            </p>
          )}
          {canApply && !alreadyApplied && isLoggedIn && (
            <Link
              href={`/tournaments/${tournamentId}/apply`}
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl bg-site-primary px-6 py-3.5 text-base font-medium text-white hover:opacity-90 transition-opacity"
            >
              참가 신청하기
            </Link>
          )}
          {!canApply && !alreadyApplied && applyClosedReason && (
            <p className="text-sm text-site-text-muted bg-site-bg/50 rounded-lg px-4 py-3">{applyClosedReason}</p>
          )}
        </div>
      </section>

      {/* 대회 정보 그리드 */}
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-site-text mb-4">대회 정보</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {entryFee != null && (
            <>
              <dt className="text-site-text-muted text-sm">참가비</dt>
              <dd className="text-site-text font-medium">{entryFee.toLocaleString()}원</dd>
            </>
          )}
          {prizeInfo && (
            <>
              <dt className="text-site-text-muted text-sm">상금</dt>
              <dd className="text-site-text whitespace-pre-wrap">{prizeInfo}</dd>
            </>
          )}
          {gameFormat && (
            <>
              <dt className="text-site-text-muted text-sm">경기 방식</dt>
              <dd className="text-site-text">{GAME_FORMAT_LABEL[gameFormat] ?? gameFormat}</dd>
            </>
          )}
          {entryCondition && (
            <>
              <dt className="text-site-text-muted text-sm">참가 조건</dt>
              <dd className="text-site-text">{entryCondition}</dd>
            </>
          )}
          <dt className="text-site-text-muted text-sm">경기 일정</dt>
          <dd className="text-site-text">{formatKoreanSchedule(startAt, endAt)}</dd>
          {venue && (
            <>
              <dt className="text-site-text-muted text-sm">대회 장소</dt>
              <dd className="text-site-text">{venue}</dd>
            </>
          )}
        </dl>
        {((tournamentVenues && tournamentVenues.length > 0) || (matchVenues && matchVenues.length > 0)) && (
          <div className="mt-4 pt-4 border-t border-site-border">
            <h3 className="text-xs font-semibold text-site-text-muted mb-2">경기장</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {tournamentVenues?.map((tv) => (
                <div key={tv.id} className="rounded-lg border border-site-border bg-site-bg/50 p-3 text-sm">
                  <div className="font-medium text-site-text">{tv.name}</div>
                  <Link
                    href={`/v/${tv.slug}`}
                    className="mt-2 inline-flex items-center rounded-md bg-site-primary/10 px-2.5 py-1 text-xs font-medium text-site-primary hover:bg-site-primary/20"
                  >
                    당구장 홍보 바로가기 →
                  </Link>
                </div>
              ))}
              {matchVenues?.map((v, i) => (
                <div key={`match-${i}`} className="rounded-lg border border-site-border bg-site-bg/50 p-3 text-sm">
                  <div className="font-medium text-site-text">[{v.displayLabel}]</div>
                  {v.venueName && <div>{v.venueName}</div>}
                  {v.address && <div className="text-site-text-muted">{v.address}</div>}
                  {v.phone && <div className="text-site-text-muted">{v.phone}</div>}
                  <p className="mt-2 text-xs text-site-text-muted">
                    캐롬클럽 사이트에 등록되지 않은 당구장(경기장)입니다.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
