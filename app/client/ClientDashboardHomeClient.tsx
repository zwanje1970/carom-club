"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import ClientAutoParticipantPushToggle from "./ClientAutoParticipantPushToggle";
import { AdminSurface } from "../components/admin/AdminCard";
import type { ClientDashboardSummaryJson } from "./dashboard-summary-types";
import {
  mergeClientDashboardSummaryCache,
  persistClientDashboardSummaryCache,
  readClientDashboardSummaryCache,
} from "./dashboard-summary-cache";

type SummaryState =
  /** 요약 전·재시도 대기 — 레이아웃은 그대로, 강한 로딩 UI 없음 */
  | { status: "shell" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ClientDashboardSummaryJson; refreshWarning?: string };

type DashboardFetchResult =
  | { ok: true; data: ClientDashboardSummaryJson }
  | { ok: false; message: string };

export type ClientDashboardSummaryBootstrap = {
  userId: string;
  clientStatus: "APPROVED" | "PENDING" | "REJECTED" | null;
  orgId: string;
  orgStatus: "ACTIVE" | "SUSPENDED" | "EXPELLED" | null;
};

const clientDashboardSummaryBootstrapContext = createContext<ClientDashboardSummaryBootstrap | null>(null);

export function ClientDashboardSummaryBootstrapProvider({
  value,
  children,
}: {
  value: ClientDashboardSummaryBootstrap | null;
  children: ReactNode;
}) {
  return (
    <clientDashboardSummaryBootstrapContext.Provider value={value}>
      {children}
    </clientDashboardSummaryBootstrapContext.Provider>
  );
}

export function useClientDashboardSummaryBootstrap(): ClientDashboardSummaryBootstrap | null {
  return useContext(clientDashboardSummaryBootstrapContext);
}

async function fetchDashboardSummary(
  bootstrap: ClientDashboardSummaryBootstrap | null,
): Promise<DashboardFetchResult> {
  try {
    const res = await fetch("/api/client/dashboard-summary", {
      method: bootstrap ? "POST" : "GET",
      credentials: "same-origin",
      headers: bootstrap ? { "Content-Type": "application/json" } : undefined,
      body: bootstrap
        ? JSON.stringify({
            userId: bootstrap.userId,
            clientStatus: bootstrap.clientStatus,
            orgId: bootstrap.orgId,
            orgStatus: bootstrap.orgStatus,
          })
        : undefined,
    });
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

let dashboardSummaryInFlight: Promise<DashboardFetchResult> | null = null;
let dashboardSummaryInFlightKey = "";

function fetchDashboardSummaryCoalesced(
  bootstrap: ClientDashboardSummaryBootstrap | null,
): Promise<DashboardFetchResult> {
  const key = JSON.stringify(bootstrap ?? null);
  if (dashboardSummaryInFlight && dashboardSummaryInFlightKey === key) return dashboardSummaryInFlight;
  dashboardSummaryInFlightKey = key;
  const p = fetchDashboardSummary(bootstrap);
  dashboardSummaryInFlight = p;
  void p.finally(() => {
    queueMicrotask(() => {
      if (dashboardSummaryInFlight === p) {
        dashboardSummaryInFlight = null;
        dashboardSummaryInFlightKey = "";
      }
    });
  });
  return dashboardSummaryInFlight;
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

const MSG_TODAY_SHELL = "아래 바로가기와 메뉴에서 이어서 진행할 수 있습니다.";
const MSG_TOURNAMENT_SHELL = "대회 목록은 전체대회 보기에서 열 수 있습니다.";
const MSG_EXTRAS_SHELL = "설정·문의 등은 아래 링크에서 바로 열 수 있습니다.";

export default function ClientDashboardHomeClient({
  bootstrap,
}: {
  bootstrap?: ClientDashboardSummaryBootstrap | null;
}) {
  const [state, setState] = useState<SummaryState>({ status: "shell" });
  const extrasDetailsRef = useRef<HTMLDetailsElement>(null);

  const onExtrasToggle = useCallback((e: SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open) return;
    requestAnimationFrame(() => {
      extrasDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const snapshot = readClientDashboardSummaryCache();
    if (snapshot) {
      setState({ status: "ready", data: snapshot });
    }

    let cancelled = false;
    const load = () => {
      if (cancelled) return;
      void (async () => {
        const r = await fetchDashboardSummaryCoalesced(bootstrap ?? null);
        if (cancelled) return;
        if (r.ok) {
          const cached = readClientDashboardSummaryCache();
          const merged =
            cached &&
            cached.hasPublishedTournamentCard === true &&
            r.data.hasPublishedTournamentCard === false
              ? { ...r.data, hasPublishedTournamentCard: true }
              : r.data;
          persistClientDashboardSummaryCache(merged);
          setState({ status: "ready", data: merged });
        } else if (snapshot) {
          setState({ status: "ready", data: snapshot, refreshWarning: r.message });
        } else {
          setState({ status: "error", message: r.message });
        }
      })();
    };

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) load();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [bootstrap]);

  const handleRetry = useCallback(() => {
    setState({ status: "shell" });
    void (async () => {
      const r = await fetchDashboardSummaryCoalesced(bootstrap ?? null);
      if (r.ok) {
        const cached = readClientDashboardSummaryCache();
        const merged =
          cached &&
          cached.hasPublishedTournamentCard === true &&
          r.data.hasPublishedTournamentCard === false
            ? { ...r.data, hasPublishedTournamentCard: true }
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
  }, [bootstrap]);

  const isReady = state.status === "ready";
  const isFetchError = state.status === "error";
  const pendingAreaMessage = isFetchError ? state.message : "";

  let todayStatusText = "";
  let todayButtonLabel = "";
  let todayButtonHref = "/client/setup";
  let membershipSection: ReactNode = null;
  let tournamentListSection: ReactNode = null;

  if (isReady) {
    const d = state.data;
    const policy = d.policy;
    const membershipLabel =
      policy.membershipState === "ACTIVE"
        ? "연회원 이용 중"
        : policy.membershipState === "EXPIRED"
          ? "연회원 만료"
          : "일반";

    if (!d.hasOrgSetup) {
      todayStatusText = "업체 설정을 먼저 완료하세요";
      todayButtonLabel = "업체 설정";
      todayButtonHref = "/client/setup";
    } else if (!d.hasVenueIntro) {
      todayStatusText = "당구장 소개를 작성하세요";
      todayButtonLabel = "작성하기";
      todayButtonHref = "/client/setup/venue-intro";
    } else if (!d.hasActiveTournament) {
      todayStatusText = "대회를 만들어 주세요";
      todayButtonLabel = "대회 만들기";
      todayButtonHref = "/client/tournaments/new";
    } else if (!d.hasPublishedTournamentCard) {
      todayStatusText = "대회 카드를 게시해 주세요";
      todayButtonLabel = "대회 관리";
      todayButtonHref = "/client/tournaments";
    } else {
      todayStatusText = "대회와 게시 카드가 준비되어 있습니다";
      todayButtonLabel = "대회 관리";
      todayButtonHref = "/client/tournaments";
    }

    membershipSection =
      policy.annualMembershipVisible ? (
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
      ) : null;

    tournamentListSection = !d.hasActiveTournament ? (
      <p className="client-dashboard-main__tournamentEmpty">진행 중인 대회가 없습니다. 대회를 만들어 주세요.</p>
    ) : !d.hasPublishedTournamentCard ? (
      <p className="client-dashboard-main__tournamentEmpty">활성 대회에 게시 카드를 올려 주세요.</p>
    ) : (
      <p className="client-dashboard-main__tournamentEmpty" style={{ marginBottom: 0 }}>
        대회와 게시 카드가 준비된 상태입니다. 상세는 대회 관리에서 확인하세요.
      </p>
    );
  }

  const todayBar =
    isReady ? (
      <Link
        href={todayButtonHref}
        prefetch={false}
        className="client-dashboard-main__todayBar client-dashboard-main__todayBarLink"
        aria-labelledby="client-today-heading client-today-cta-label"
        aria-describedby="client-today-status"
      >
        <h2 id="client-today-heading" className="client-dashboard-main__todayBarHeading">
          지금 할 일
        </h2>
        <p id="client-today-status" className="client-dashboard-main__todayBarText">
          {todayStatusText}
        </p>
        <span id="client-today-cta-label" className="client-dashboard-main__todayBarBtn" aria-hidden="true">
          {todayButtonLabel}
        </span>
      </Link>
    ) : isFetchError ? (
      <div
        className="client-dashboard-main__todayBar"
        role="alert"
        aria-labelledby="client-today-heading"
      >
        <h2 id="client-today-heading" className="client-dashboard-main__todayBarHeading">
          지금 할 일
        </h2>
        <p id="client-today-status" className="client-dashboard-main__todayBarText">
          {pendingAreaMessage}
        </p>
        <button
          type="button"
          className="client-dashboard-main__todayBarBtn"
          style={{ border: "none", background: "transparent", font: "inherit", cursor: "pointer", color: "inherit" }}
          onClick={() => void handleRetry()}
        >
          다시 시도
        </button>
      </div>
    ) : (
      <Link
        href="/client/setup"
        prefetch={false}
        className="client-dashboard-main__todayBar client-dashboard-main__todayBarLink"
        aria-labelledby="client-today-heading client-today-cta-label"
        aria-describedby="client-today-status"
      >
        <h2 id="client-today-heading" className="client-dashboard-main__todayBarHeading">
          지금 할 일
        </h2>
        <p id="client-today-status" className="client-dashboard-main__todayBarText">
          {MSG_TODAY_SHELL}
        </p>
        <span id="client-today-cta-label" className="client-dashboard-main__todayBarBtn" aria-hidden="true">
          업체 설정
        </span>
      </Link>
    );

  return (
    <div className="v3-stack" style={{ gap: "1.15rem" }}>
      {isReady && state.refreshWarning ? (
        <p className="v3-muted" role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "#b45309" }}>
          {state.refreshWarning} (화면은 이전에 불러온 내용입니다.)
        </p>
      ) : null}

      {todayBar}

      {membershipSection}

      <section className="v3-stack" aria-labelledby="client-ongoing-tournaments-heading" style={{ gap: "0.5rem" }}>
        <h2 id="client-ongoing-tournaments-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          진행중 대회
        </h2>
        {isReady ? (
          tournamentListSection
        ) : (
          <p className="v3-muted" style={{ margin: 0 }}>
            {isFetchError ? pendingAreaMessage : MSG_TOURNAMENT_SHELL}
          </p>
        )}
        <Link href="/client/tournaments" prefetch={false} className="client-dashboard-main__tournamentSeeAll">
          전체대회 보기
        </Link>
      </section>

      <section className="v3-stack" aria-labelledby="client-main-features-heading" style={{ gap: "0.5rem" }}>
        <h2 id="client-main-features-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          주요 기능
        </h2>
        <div className="client-dashboard-main__featureStack">
          <Link
            href="/client/tournaments/new"
            prefetch={false}
            className="client-dashboard-main__featureCard client-dashboard-main__featureCard--primary client-dashboard-main__featureCard--hero"
          >
            <span className="client-dashboard-main__featureIconWrap">
              <IconTournamentLine />
            </span>
            <span className="client-dashboard-main__featureText">
              <span className="client-dashboard-main__featureTitle">대회 만들기</span>
              <span className="client-dashboard-main__featureDesc">새 대회를 등록하고 일정을 관리합니다</span>
            </span>
          </Link>
          <div className="client-dashboard-main__featureRowSplit">
            <Link href="/client/member" prefetch={false} className="client-dashboard-main__featureCard client-dashboard-main__featureCard--purple">
              <span className="client-dashboard-main__featureIconWrap">
                <IconUsersLine />
              </span>
              <span className="client-dashboard-main__featureText">
                <span className="client-dashboard-main__featureTitle">회원 / 앱푸시</span>
                <span className="client-dashboard-main__featureDesc">참가자·푸시 알림을 다룹니다</span>
              </span>
            </Link>
            <Link href="/client/settlement" prefetch={false} className="client-dashboard-main__featureCard client-dashboard-main__featureCard--warning">
              <span className="client-dashboard-main__featureIconWrap">
                <IconChartLine />
              </span>
              <span className="client-dashboard-main__featureText">
                <span className="client-dashboard-main__featureTitle">정산</span>
                <span className="client-dashboard-main__featureDesc">대회별 정산을 확인합니다</span>
              </span>
            </Link>
          </div>
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
            {!isReady ? (
              <p className="v3-muted" style={{ margin: 0, padding: "0.25rem 0" }}>
                {isFetchError ? pendingAreaMessage : MSG_EXTRAS_SHELL}
              </p>
            ) : null}
            {isReady ? (
              <ClientAutoParticipantPushToggle
                initialEnabled={state.data.autoParticipantPushEnabled}
                onPersisted={(enabled) => {
                  mergeClientDashboardSummaryCache({ autoParticipantPushEnabled: enabled });
                  setState((s) =>
                    s.status === "ready"
                      ? { ...s, data: { ...s.data, autoParticipantPushEnabled: enabled } }
                      : s,
                  );
                }}
              />
            ) : null}
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
