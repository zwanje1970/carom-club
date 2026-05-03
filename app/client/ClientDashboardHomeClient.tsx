"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ClientAutoParticipantPushToggle from "./ClientAutoParticipantPushToggle";
import { AdminSurface } from "../components/admin/AdminCard";
import type { ClientDashboardSummaryJson } from "./dashboard-summary-types";
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

function GuardedNavLink({
  href,
  children,
  hasOrgSetup,
}: {
  href: string;
  children: React.ReactNode;
  hasOrgSetup: boolean;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={false}
      className="client-dashboard-main__menuLink"
      onClick={(e) => {
        if (hasOrgSetup) return;
        e.preventDefault();
        window.alert("업체 설정을 먼저 완료하세요.");
        router.push("/client/setup");
      }}
    >
      {children}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="v3-stack" style={{ gap: "0.65rem" }} aria-busy="true" aria-label="대시보드 불러오는 중">
      <div
        className="client-dashboard-main__statusbar client-dashboard-main__statusbar--skeleton"
        aria-hidden
        style={{ minHeight: "2.65rem", borderRadius: 8, background: "#e5e7eb" }}
      />
      <div className="v3-stack" style={{ gap: "0.4rem" }}>
        {[1, 2, 3, 4].map((k) => (
          <div key={k} style={{ height: "2.5rem", borderRadius: 8, background: "#eef2f7" }} />
        ))}
      </div>
    </div>
  );
}

export default function ClientDashboardHomeClient() {
  const [state, setState] = useState<SummaryState>({ status: "loading" });
  const didStartInitialLoadRef = useRef(false);

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
        persistClientDashboardSummaryCache(r.data);
        setState({ status: "ready", data: r.data });
      } else if (snapshot) {
        setState({ status: "ready", data: snapshot, refreshWarning: r.message });
      } else {
        setState({ status: "error", message: r.message });
      }
    })();
  }, []);

  const handleRetry = useCallback(() => {
    setState({ status: "loading" });
    void (async () => {
      const r = await fetchDashboardSummaryCoalesced();
      if (r.ok) {
        persistClientDashboardSummaryCache(r.data);
        setState({ status: "ready", data: r.data });
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
  const policy = d.policy;
  const membershipLabel =
    policy.membershipState === "ACTIVE"
      ? "연회원 이용 중"
      : policy.membershipState === "EXPIRED"
        ? "연회원 만료"
        : "일반";

  let statusText = "";
  let statusButtonLabel = "";
  let statusButtonHref = "/client/setup";
  if (!d.hasOrgSetup) {
    statusText = "업체 설정을 먼저 완료하세요";
    statusButtonLabel = "업체 설정";
    statusButtonHref = "/client/setup";
  } else if (!d.hasVenueIntro) {
    statusText = "당구장 소개를 작성하세요";
    statusButtonLabel = "작성하기";
    statusButtonHref = "/client/setup/venue-intro";
  } else if (!d.hasAnyTournament) {
    statusText = "대회를 개최하세요";
    statusButtonLabel = "대회 만들기";
    statusButtonHref = "/client/tournaments/new";
  } else if (!d.hasPublishedActiveForSomeTournament) {
    statusText = "메인에 대회 홍보용 카드를 게시하세요";
    statusButtonLabel = "게시카드 작성";
    statusButtonHref = d.firstTournamentId
      ? `/client/tournaments/${d.firstTournamentId}/card-publish-v2`
      : "/client/tournaments/new";
  } else {
    statusText = "진행중인 대회가 있습니다";
    statusButtonLabel = "대회 관리";
    statusButtonHref = d.firstTournamentId ? `/client/tournaments/${d.firstTournamentId}` : "/client/tournaments";
  }

  const cardManageHref = d.firstTournamentId
    ? `/client/tournaments/${d.firstTournamentId}/card-publish-v2`
    : "/client/tournaments/new";

  return (
    <div className="v3-stack" style={{ gap: "0.85rem" }}>
      {state.refreshWarning ? (
        <p className="v3-muted" role="alert" style={{ margin: 0, fontSize: "0.82rem", color: "#b45309" }}>
          {state.refreshWarning} (화면은 이전에 불러온 내용입니다.)
        </p>
      ) : null}

      <section className="client-dashboard-main__statusbar" aria-label="지금 해야 할 일">
        <p className="client-dashboard-main__statusbarText">{statusText}</p>
        <Link href={statusButtonHref} prefetch={false} className="v3-btn client-dashboard-main__statusbarBtn">
          {statusButtonLabel}
        </Link>
      </section>

      <section className="v3-stack client-dashboard-main__menuSection" aria-labelledby="client-dashboard-menu-heading">
        <h2 id="client-dashboard-menu-heading" className="v3-h2" style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800 }}>
          메뉴
        </h2>
        <nav className="client-dashboard-main__menuList" aria-label="주요 메뉴">
          <GuardedNavLink href="/client/tournaments" hasOrgSetup={d.hasOrgSetup}>
            대회 관리
          </GuardedNavLink>
          <GuardedNavLink href={cardManageHref} hasOrgSetup={d.hasOrgSetup}>
            게시카드 관리
          </GuardedNavLink>
          <GuardedNavLink href="/client/member" hasOrgSetup={d.hasOrgSetup}>
            회원 / 앱푸시
          </GuardedNavLink>
          <GuardedNavLink href="/client/settlements" hasOrgSetup={d.hasOrgSetup}>
            정산
          </GuardedNavLink>
        </nav>
      </section>

      {policy.annualMembershipVisible ? (
        <AdminSurface className="v3-stack client-dashboard-main__dsCard" style={{ gap: "0.5rem", padding: "0.75rem" }}>
          <h2 className="v3-h2" style={{ margin: 0, fontSize: "0.88rem" }}>
            연회원 상태
          </h2>
          <p style={{ margin: 0, fontSize: "0.86rem" }}>현재 상태: {membershipLabel}</p>
          {policy.annualMembershipEnforced ? (
            policy.membershipState === "ACTIVE" ? (
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                연회원 제한 모드입니다.
              </p>
            ) : (
              <>
                <p className="v3-muted client-dashboard-main__warn" style={{ margin: 0, fontSize: "0.82rem" }}>
                  이 기능은 연회원 전용입니다
                </p>
                <div className="v3-row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
                  <Link className="v3-btn" href="/client/settings" prefetch={false} style={{ fontSize: "0.82rem", padding: "0.35rem 0.6rem" }}>
                    연회원 안내
                  </Link>
                  <Link className="v3-btn" href="/client/settings" prefetch={false} style={{ fontSize: "0.82rem", padding: "0.35rem 0.6rem" }}>
                    가입하기
                  </Link>
                </div>
              </>
            )
          ) : (
            <>
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                연회원으로 더 많은 기능을 이용할 수 있습니다
              </p>
              <Link className="v3-btn" href="/client/settings" prefetch={false} style={{ fontSize: "0.82rem", padding: "0.35rem 0.6rem", width: "fit-content" }}>
                연회원 안내 보기
              </Link>
            </>
          )}
        </AdminSurface>
      ) : null}

      <section aria-label="부가기능">
        <details className="client-dashboard-main__dsCard client-dashboard-main__extras">
          <summary style={{ cursor: "pointer", padding: "0.55rem 0.75rem", fontWeight: 700, fontSize: "0.88rem" }}>
            부가기능
          </summary>
          <div className="client-dashboard-main__extrasList">
            <ClientAutoParticipantPushToggle
              initialEnabled={d.autoParticipantPushEnabled}
              onPersisted={(enabled) => {
                mergeClientDashboardSummaryCache({ autoParticipantPushEnabled: enabled });
                setState((s) =>
                  s.status === "ready" ? { ...s, data: { ...s.data, autoParticipantPushEnabled: enabled } } : s,
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
