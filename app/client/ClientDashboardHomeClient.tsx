"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import ClientAutoParticipantPushToggle from "./ClientAutoParticipantPushToggle";
import { AdminSurface } from "../components/admin/AdminCard";
import type { ClientDashboardSummaryJson } from "./dashboard-summary-types";
import type { TournamentStatusBadge } from "../../lib/server/platform-backing-store";
import {
  mergeClientDashboardSummaryCache,
  persistClientDashboardSummaryCache,
  readClientDashboardSummaryCache,
} from "./dashboard-summary-cache";

type SummaryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ClientDashboardSummaryJson; refreshWarning?: string };

type DashboardFetchResult =
  | { ok: true; data: ClientDashboardSummaryJson }
  | { ok: false; message: string };

type DashboardPublishedCardStatusResult =
  | { ok: true; hasPublishedActiveForSomeTournament: boolean }
  | { ok: false };

async function fetchDashboardSummary(): Promise<DashboardFetchResult> {
  try {
    const res = await fetch("/api/client/dashboard-summary", { credentials: "same-origin" });
    const json = (await res.json()) as ClientDashboardSummaryJson | { ok: false; error?: string };
    if (!res.ok || !("ok" in json) || json.ok !== true) {
      const msg =
        typeof (json as { error?: string }).error === "string"
          ? (json as { error: string }).error
          : "대시보드를 불러오지 못했습니다.";
      return { ok: false, message: msg };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, message: "네트워크 오류로 불러오지 못했습니다." };
  }
}

async function fetchDashboardPublishedCardStatus(
  tournamentId: string,
): Promise<DashboardPublishedCardStatusResult> {
  const id = tournamentId.trim();
  if (!id) return { ok: false };
  try {
    const res = await fetch(
      `/api/client/dashboard-summary/published-card-status?tournamentId=${encodeURIComponent(id)}`,
      { credentials: "same-origin" },
    );
    const json = (await res.json()) as
      | { ok: true; hasPublishedActiveForSomeTournament: boolean }
      | { ok: false; error?: string };
    if (!res.ok || json.ok !== true) return { ok: false };
    return {
      ok: true,
      hasPublishedActiveForSomeTournament:
        json.hasPublishedActiveForSomeTournament === true,
    };
  } catch {
    return { ok: false };
  }
}

let dashboardSummaryInFlight: Promise<DashboardFetchResult> | null = null;

function fetchDashboardSummaryCoalesced(): Promise<DashboardFetchResult> {
  if (dashboardSummaryInFlight) return dashboardSummaryInFlight;
  const p = fetchDashboardSummary();
  dashboardSummaryInFlight = p;
  void p.finally(() => {
    queueMicrotask(() => {
      if (dashboardSummaryInFlight === p) dashboardSummaryInFlight = null;
    });
  });
  return dashboardSummaryInFlight;
}

function clientDashboardTournamentBadgeClass(badge: TournamentStatusBadge): string {
  switch (badge) {
    case "모집중":
      return "client-dashboard-main__tournamentBadge client-dashboard-main__tournamentBadge--success";
    case "마감임박":
      return "client-dashboard-main__tournamentBadge client-dashboard-main__tournamentBadge--warning";
    case "마감":
    case "종료":
    case "초안":
      return "client-dashboard-main__tournamentBadge client-dashboard-main__tournamentBadge--neutral";
    case "예정":
      return "client-dashboard-main__tournamentBadge client-dashboard-main__tournamentBadge--purple";
  }
}

function IconTournamentLine() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M8 21h8M12 17v4M6 3h12v2l-1 8a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4L6 5V3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCardLine() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 15l4.5-4.5 3 3L15 9l6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsersLine() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChartLine() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7 19V11M12 19V5M17 19v-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExtrasToolbox() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M2 8h4M10 8h12M2 12h8M14 12h8M2 16h10M16 16h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <circle cx="17" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <circle cx="13" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
    </svg>
  );
}

function formatTournamentCardSubtitle(t: { date: string; maxParticipants: number }): string {
  const date = (t.date ?? "").trim() || "—";
  const n = t.maxParticipants;
  const g = typeof n === "number" && Number.isFinite(n) && n > 0 ? `${Math.floor(n)}강` : "—";
  return `${date} / ${g}`;
}

function DashboardSkeleton() {
  return (
    <div className="v3-stack" style={{ gap: "1.15rem" }} aria-busy="true" aria-label="대시보드 내용 불러오는 중">
      <section className="client-dashboard-main__todayBar client-dashboard-main__todayBar--skeleton" aria-hidden>
        <div className="skeleton-line" style={{ height: "0.85rem", width: "5rem", borderRadius: 6, background: "#e5e7eb" }} />
        <div className="skeleton-line" style={{ height: "0.85rem", flex: 1, borderRadius: 6, background: "#e5e7eb" }} />
        <div className="skeleton-line" style={{ height: "2rem", width: "6rem", borderRadius: 8, background: "#e5e7eb" }} />
      </section>
      <section className="v3-stack client-dashboard-main__dsCard" style={{ gap: "0.5rem" }} aria-hidden>
        <div className="skeleton-line" style={{ height: "1rem", width: "40%", borderRadius: 6, background: "#e5e7eb" }} />
        <div className="skeleton-line" style={{ height: "0.85rem", width: "70%", borderRadius: 6, background: "#e5e7eb" }} />
      </section>
      <section className="v3-stack" style={{ gap: "0.5rem" }} aria-hidden>
        <div className="skeleton-line" style={{ height: "1rem", width: "35%", borderRadius: 6, background: "#e5e7eb" }} />
        <div className="v3-stack" style={{ gap: "0.45rem" }}>
          <div className="client-dashboard-main__dsCard skeleton-line" style={{ height: "4.2rem", borderRadius: 12, background: "#eef2f7" }} />
        </div>
      </section>
      <section className="v3-stack" style={{ gap: "0.5rem" }} aria-hidden>
        <div className="skeleton-line" style={{ height: "1rem", width: "30%", borderRadius: 6, background: "#e5e7eb" }} />
        <div className="client-dashboard-main__featureGrid">
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              className="client-dashboard-main__featureCard skeleton-line"
              style={{ minHeight: "4.5rem", borderRadius: 12, background: "#eef2f7" }}
            />
          ))}
        </div>
      </section>
      <section aria-hidden>
        <div className="client-dashboard-main__dsCard skeleton-line" style={{ height: "2.75rem", borderRadius: 12, background: "#eef2f7" }} />
      </section>
    </div>
  );
}

export default function ClientDashboardHomeClient() {
  const [state, setState] = useState<SummaryState>({ status: "loading" });
  const [publishedCardStatus, setPublishedCardStatus] = useState<{
    tournamentId: string;
    state: "idle" | "checking" | "resolved" | "failed";
  }>({ tournamentId: "", state: "idle" });
  const extrasDetailsRef = useRef<HTMLDetailsElement>(null);
  const didStartInitialLoadRef = useRef(false);
  const publishedCardStatusInFlightForRef = useRef<string>("");

  const onExtrasToggle = useCallback((e: SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open) return;
    requestAnimationFrame(() => {
      extrasDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (didStartInitialLoadRef.current) return;
    didStartInitialLoadRef.current = true;

    const snapshot = readClientDashboardSummaryCache();
    if (snapshot) {
      setState({ status: "ready", data: snapshot });
    }
    void (async () => {
      const r = await fetchDashboardSummaryCoalesced();
      if (r.ok) {
        const cached = readClientDashboardSummaryCache();
        const merged =
          cached &&
          cached.firstTournamentId.trim() === r.data.firstTournamentId.trim() &&
          cached.hasPublishedActiveForSomeTournament === true &&
          r.data.hasPublishedActiveForSomeTournament === false
            ? { ...r.data, hasPublishedActiveForSomeTournament: true }
            : r.data;
        persistClientDashboardSummaryCache(merged);
        setState({ status: "ready", data: merged });
      } else if (snapshot) {
        setState({ status: "ready", data: snapshot, refreshWarning: r.message });
      } else {
        setState({ status: "error", message: r.message });
      }
    })();
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const tid = state.data.firstTournamentId.trim();
    if (!state.data.hasAnyTournament || !tid) {
      setPublishedCardStatus((prev) =>
        prev.state === "idle" && prev.tournamentId === "" ? prev : { tournamentId: "", state: "idle" },
      );
      return;
    }
    setPublishedCardStatus((prev) => {
      if (prev.tournamentId !== tid) return { tournamentId: tid, state: "checking" };
      if (prev.state === "idle" || prev.state === "failed") return { tournamentId: tid, state: "checking" };
      return prev;
    });
    if (publishedCardStatusInFlightForRef.current === tid) return;
    publishedCardStatusInFlightForRef.current = tid;
    let cancelled = false;
    void (async () => {
      const r = await fetchDashboardPublishedCardStatus(tid);
      if (cancelled) return;
      if (publishedCardStatusInFlightForRef.current === tid) {
        publishedCardStatusInFlightForRef.current = "";
      }
      if (!r.ok) {
        setPublishedCardStatus((prev) =>
          prev.tournamentId === tid ? { tournamentId: tid, state: "failed" } : prev,
        );
        return;
      }
      mergeClientDashboardSummaryCache({
        hasPublishedActiveForSomeTournament: r.hasPublishedActiveForSomeTournament,
      });
      setPublishedCardStatus({ tournamentId: tid, state: "resolved" });
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        if (prev.data.firstTournamentId.trim() !== tid) return prev;
        if (
          prev.data.hasPublishedActiveForSomeTournament ===
          r.hasPublishedActiveForSomeTournament
        ) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...prev.data,
            hasPublishedActiveForSomeTournament:
              r.hasPublishedActiveForSomeTournament,
          },
        };
      });
    })();
    return () => {
      cancelled = true;
      if (publishedCardStatusInFlightForRef.current === tid) {
        publishedCardStatusInFlightForRef.current = "";
      }
    };
  }, [state]);

  const handleRetry = useCallback(() => {
    setState({ status: "loading" });
    void (async () => {
      const r = await fetchDashboardSummaryCoalesced();
      if (r.ok) {
        const cached = readClientDashboardSummaryCache();
        const merged =
          cached &&
          cached.firstTournamentId.trim() === r.data.firstTournamentId.trim() &&
          cached.hasPublishedActiveForSomeTournament === true &&
          r.data.hasPublishedActiveForSomeTournament === false
            ? { ...r.data, hasPublishedActiveForSomeTournament: true }
            : r.data;
        persistClientDashboardSummaryCache(merged);
        setState({ status: "ready", data: merged });
      } else {
        const snap = readClientDashboardSummaryCache();
        if (snap) {
          setState({ status: "ready", data: snap, refreshWarning: r.message });
        } else {
          setState({ status: "error", message: r.message });
        }
      }
    })();
  }, []);

  if (state.status === "loading") {
    return <DashboardSkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="v3-stack client-dashboard-main__dsCard" style={{ gap: "0.65rem", padding: "1rem" }}>
        <p className="v3-muted" style={{ margin: 0 }}>
          {state.message}
        </p>
        <button type="button" className="v3-btn" onClick={() => void handleRetry()}>
          다시 시도
        </button>
      </div>
    );
  }

  const d = state.data;
  const firstTournamentId = d.firstTournamentId.trim();
  const isPublishedCardStatusPending =
    d.hasAnyTournament &&
    firstTournamentId !== "" &&
    d.hasPublishedActiveForSomeTournament !== true &&
    publishedCardStatus.tournamentId === firstTournamentId &&
    publishedCardStatus.state === "checking";
  const isPublishedCardStatusUnknown =
    d.hasAnyTournament &&
    firstTournamentId !== "" &&
    d.hasPublishedActiveForSomeTournament !== true &&
    (publishedCardStatus.tournamentId !== firstTournamentId ||
      publishedCardStatus.state === "checking" ||
      publishedCardStatus.state === "failed");
  const policy = d.policy;
  const membershipLabel =
    policy.membershipState === "ACTIVE"
      ? "연회원 이용 중"
      : policy.membershipState === "EXPIRED"
        ? "연회원 만료"
        : "일반";

  let todayStatusText = "";
  let todayButtonLabel = "";
  let todayButtonHref = "/client/setup";
  if (!d.hasOrgSetup) {
    todayStatusText = "업체 설정을 먼저 완료하세요";
    todayButtonLabel = "업체 설정";
    todayButtonHref = "/client/setup";
  } else if (!d.hasVenueIntro) {
    todayStatusText = "당구장 소개를 작성하세요";
    todayButtonLabel = "작성하기";
    todayButtonHref = "/client/setup/venue-intro";
  } else if (!d.hasAnyTournament) {
    todayStatusText = "대회를 개최하세요";
    todayButtonLabel = "대회 만들기";
    todayButtonHref = "/client/tournaments/new";
  } else if (isPublishedCardStatusPending || isPublishedCardStatusUnknown) {
    todayStatusText = "게시카드 상태를 확인 중입니다";
    todayButtonLabel = "대회 관리";
    todayButtonHref = d.firstTournamentId ? `/client/tournaments/${d.firstTournamentId}` : "/client/tournaments";
  } else if (!d.hasPublishedActiveForSomeTournament) {
    todayStatusText = "메인에 대회 홍보용 카드를 게시하세요";
    todayButtonLabel = "게시카드 작성";
    todayButtonHref = d.firstTournamentId
      ? `/client/tournaments/${d.firstTournamentId}/card-publish-v2`
      : "/client/tournaments/new";
  } else {
    todayStatusText = "진행중인 대회가 있습니다";
    todayButtonLabel = "대회 관리";
    todayButtonHref = d.firstTournamentId ? `/client/tournaments/${d.firstTournamentId}` : "/client/tournaments";
  }

  const cardPublishHref = d.firstTournamentId
    ? `/client/tournaments/${d.firstTournamentId}/card-publish-v2`
    : "/client/tournaments/new";

  const ongoingTournamentsToRender = d.recentTournaments.slice(0, 1);

  return (
    <div className="v3-stack" style={{ gap: "1.15rem" }}>
      {state.refreshWarning ? (
        <p className="v3-muted" role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "#b45309" }}>
          {state.refreshWarning} (화면은 이전에 불러온 내용입니다.)
        </p>
      ) : null}

      <section className="client-dashboard-main__todayBar" aria-labelledby="client-today-heading">
        <h2 id="client-today-heading" className="client-dashboard-main__todayBarHeading">
          오늘 할 일
        </h2>
        <p className="client-dashboard-main__todayBarText">{todayStatusText}</p>
        <Link href={todayButtonHref} prefetch={false} className="v3-btn client-dashboard-main__todayBarBtn">
          {todayButtonLabel}
        </Link>
      </section>

      {policy.annualMembershipVisible ? (
        <AdminSurface className="v3-stack client-dashboard-main__dsCard" style={{ gap: "0.65rem" }}>
          <h2 className="v3-h2">연회원 상태</h2>
          <p>현재 상태: {membershipLabel}</p>
          {policy.annualMembershipEnforced ? (
            policy.membershipState === "ACTIVE" ? (
              <p className="v3-muted">연회원 제한 모드입니다. 연회원 전용 기능을 이용할 수 있습니다.</p>
            ) : (
              <>
                <p className="v3-muted client-dashboard-main__warn">이 기능은 연회원 전용입니다</p>
                <p className="v3-muted" style={{ marginTop: 0 }}>
                  연회원 가입 후 이용 가능합니다
                </p>
                <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <Link className="v3-btn" href="/client/settings" prefetch={false}>
                    연회원 안내
                  </Link>
                  <Link className="v3-btn" href="/client/settings" prefetch={false}>
                    가입하기
                  </Link>
                </div>
              </>
            )
          ) : (
            <>
              <p className="v3-muted">연회원으로 더 많은 기능을 이용할 수 있습니다</p>
              <p className="v3-muted" style={{ marginTop: 0 }}>
                연회원 가입 시 이용 가능합니다
              </p>
              <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <Link className="v3-btn" href="/client/settings" prefetch={false}>
                  연회원 안내 보기
                </Link>
              </div>
            </>
          )}
        </AdminSurface>
      ) : null}

      <section className="v3-stack" aria-labelledby="client-ongoing-tournaments-heading" style={{ gap: "0.5rem" }}>
        <h2 id="client-ongoing-tournaments-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          진행중 대회
        </h2>
        {d.recentTournaments.length === 0 ? (
          <p className="client-dashboard-main__tournamentEmpty">진행중 대회가 없습니다</p>
        ) : (
          <ul className="v3-stack client-dashboard-main__tournamentList" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ongoingTournamentsToRender.map((t) => (
              <li key={t.id} className="v3-stack client-dashboard-main__dsCard client-dashboard-main__tournamentCard">
                <div className="client-dashboard-main__tournamentTop">
                  <div className="client-dashboard-main__tournamentTitle">{t.title}</div>
                  <span className={clientDashboardTournamentBadgeClass(t.statusBadge)}>{t.statusBadge}</span>
                </div>
                <div className="client-dashboard-main__tournamentMeta">{formatTournamentCardSubtitle(t)}</div>
                <div className="client-dashboard-main__tournamentActions">
                  <Link className="client-dashboard-main__tournamentManage" href={`/client/tournaments/${t.id}`} prefetch={false}>
                    관리하기
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/client/tournaments" prefetch={false} className="client-dashboard-main__tournamentSeeAll">
          전체대회 보기
        </Link>
      </section>

      <section className="v3-stack" aria-labelledby="client-main-features-heading" style={{ gap: "0.5rem" }}>
        <h2 id="client-main-features-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          주요 기능
        </h2>
        <div className="client-dashboard-main__featureGrid">
          <Link
            href="/client/tournaments/new"
            prefetch={false}
            className="client-dashboard-main__featureCard client-dashboard-main__featureCard--primary"
          >
            <span className="client-dashboard-main__featureIconWrap">
              <IconTournamentLine />
            </span>
            <span className="client-dashboard-main__featureText">
              <span className="client-dashboard-main__featureTitle">대회 만들기</span>
              <span className="client-dashboard-main__featureDesc">새 대회를 등록하고 일정을 관리합니다</span>
            </span>
          </Link>
          <Link href={cardPublishHref} prefetch={false} className="client-dashboard-main__featureCard client-dashboard-main__featureCard--success">
            <span className="client-dashboard-main__featureIconWrap">
              <IconCardLine />
            </span>
            <span className="client-dashboard-main__featureText">
              <span className="client-dashboard-main__featureTitle">게시카드 만들기</span>
              <span className="client-dashboard-main__featureDesc">메인 노출용 대회 카드를 작성합니다</span>
            </span>
          </Link>
          <Link href="/client/member" prefetch={false} className="client-dashboard-main__featureCard client-dashboard-main__featureCard--purple">
            <span className="client-dashboard-main__featureIconWrap">
              <IconUsersLine />
            </span>
            <span className="client-dashboard-main__featureText">
              <span className="client-dashboard-main__featureTitle">회원 / 앱푸시</span>
              <span className="client-dashboard-main__featureDesc">참가자·푸시 알림을 다룹니다</span>
            </span>
          </Link>
          <Link href="/client/settlements" prefetch={false} className="client-dashboard-main__featureCard client-dashboard-main__featureCard--warning">
            <span className="client-dashboard-main__featureIconWrap">
              <IconChartLine />
            </span>
            <span className="client-dashboard-main__featureText">
              <span className="client-dashboard-main__featureTitle">정산</span>
              <span className="client-dashboard-main__featureDesc">대회별 정산을 확인합니다</span>
            </span>
          </Link>
        </div>
      </section>

      <section aria-label="부가기능">
        <details
          ref={extrasDetailsRef}
          className="client-dashboard-main__dsCard client-dashboard-main__extras"
          onToggle={onExtrasToggle}
        >
          <summary>
            <span className="client-dashboard-main__extrasSummaryLeft">
              <span className="client-dashboard-main__extrasIconWrap">
                <IconExtrasToolbox />
              </span>
              <span className="client-dashboard-main__extrasSummaryTitle">부가기능</span>
            </span>
            <span className="client-dashboard-main__extrasSummaryChevron" aria-hidden>
              ▼
            </span>
          </summary>
          <div className="client-dashboard-main__extrasList">
            <ClientAutoParticipantPushToggle
              initialEnabled={d.autoParticipantPushEnabled}
              onPersisted={(enabled) => {
                mergeClientDashboardSummaryCache({ autoParticipantPushEnabled: enabled });
                setState((s) =>
                  s.status === "ready"
                    ? { ...s, data: { ...s.data, autoParticipantPushEnabled: enabled } }
                    : s,
                );
              }}
            />
            <Link href="/client/setup" prefetch={false} className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">업체 설정</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                &gt;
              </span>
            </Link>
            <Link href="/client/setup/venue-intro" prefetch={false} className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">당구장 소개</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                &gt;
              </span>
            </Link>
            <Link href="/client/settings/inquiries" prefetch={false} className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">문의 (오류제보 / 기능건의)</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                &gt;
              </span>
            </Link>
            <Link href="/client/settings/blank-bracket-print" prefetch={false} className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">빈 대진표</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                &gt;
              </span>
            </Link>
          </div>
        </details>
      </section>
    </div>
  );
}
