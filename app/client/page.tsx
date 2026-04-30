import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import { AdminSurface } from "../components/admin/AdminCard";
import { getRequestSessionUser } from "../../lib/server/request-session-user";
import { getClientDashboardPolicy } from "../../lib/surface-read";
import { isFirestoreUsersBackendConfigured } from "../../lib/server/firestore-users";
import {
  listTournamentsByCreator,
  loadTournamentPublishedCardsArray,
  resolveClientOrganizationForDashboardPolicy,
  type Tournament,
  type TournamentStatusBadge,
} from "../../lib/server/platform-backing-store";

/** 표시용 클래스만 — statusBadge 값에 대한 정적 분기(자동 계산 없음) */
function clientDashboardTournamentBadgeClass(badge: TournamentStatusBadge): string {
  switch (badge) {
    case "모집중":
    case "대기자모집":
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

function formatTournamentCardSubtitle(t: Pick<Tournament, "date" | "maxParticipants">): string {
  const date = (t.date ?? "").trim() || "—";
  const n = t.maxParticipants;
  const g = typeof n === "number" && Number.isFinite(n) && n > 0 ? `${Math.floor(n)}강` : "—";
  return `${date} / ${g}`;
}

export default async function ClientHomePage() {
  const currentUser = await getRequestSessionUser();
  const userId = currentUser?.id?.trim() ?? "";
  const policy = userId ? await getClientDashboardPolicy(userId) : null;
  const membershipLabel =
    policy?.membershipState === "ACTIVE"
      ? "연회원 이용 중"
      : policy?.membershipState === "EXPIRED"
        ? "연회원 만료"
        : "일반";
  const greetingName = (currentUser?.name ?? "").trim() || "○○";

  const org = userId ? await resolveClientOrganizationForDashboardPolicy(userId) : null;
  let tournaments: Tournament[] = [];
  if (userId) {
    if (isFirestoreUsersBackendConfigured()) {
      const { listTournamentsByCreatorFirestore } = await import("../../lib/server/firestore-tournaments");
      tournaments = await listTournamentsByCreatorFirestore(userId);
    } else {
      tournaments = await listTournamentsByCreator(userId);
    }
  }
  const publishedCards = userId ? await loadTournamentPublishedCardsArray() : [];

  const hasOrgSetup = Boolean(org?.setupCompleted);
  const hasAnyTournament = tournaments.length > 0;
  const myTournamentIds = tournaments.map((t) => t.id);
  const hasPublishedActiveForSomeTournament = publishedCards.some(
    (c) =>
      myTournamentIds.includes(c.tournamentId) && c.isPublished === true && c.isActive === true,
  );

  let mainStatusText = "";
  let mainButtonLabel = "";
  let mainButtonHref = "/client";
  if (!hasOrgSetup) {
    mainStatusText = "업체 설정이 필요합니다";
    mainButtonLabel = "업체 설정하기";
    mainButtonHref = "/client/setup";
  } else if (!hasAnyTournament) {
    mainStatusText = "대회를 먼저 만들어 주세요";
    mainButtonLabel = "대회 만들기";
    mainButtonHref = "/client/tournaments/new";
  } else if (!hasPublishedActiveForSomeTournament) {
    mainStatusText = "게시카드를 작성해야 합니다";
    mainButtonLabel = "게시카드 만들기";
    mainButtonHref = `/client/tournaments/${tournaments[0]!.id}/card-publish-v2`;
  } else {
    mainStatusText = "현재 대회가 운영 중입니다";
    mainButtonLabel = "대회 관리";
    mainButtonHref = "/client/tournaments";
  }

  const displayTournaments = tournaments.slice(0, 3);
  const firstTournamentId = tournaments[0]?.id ?? "";
  const cardPublishHref = firstTournamentId
    ? `/client/tournaments/${firstTournamentId}/card-publish-v2`
    : "/client/tournaments/new";

  return (
    <main className="v3-page v3-stack ui-client-dashboard client-dashboard-main" style={{ gap: "1.15rem" }}>
      {/* 1. 상단 영역 */}
      <header
        className="v3-row ui-client-dashboard-header"
        style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>안녕하세요, {greetingName}님</p>
        <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="v3-btn" disabled aria-label="공지 (자리)">
            공지
          </button>
          <span className="v3-muted" style={{ fontSize: "0.9rem" }}>
            ❓ 안내 ON/OFF (자리)
          </span>
          <LogoutButton redirectTo="/" />
        </div>
      </header>

      {/* 2. 현재 해야 할 일 — 상단 제목 / 중단 상태 문구 / 하단 버튼 1개 */}
      <section className="v3-stack client-dashboard-main__cta" aria-labelledby="client-main-action-heading">
        <h2 id="client-main-action-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          👉 지금 해야 할 일
        </h2>
        <p style={{ margin: 0, fontSize: "0.95rem" }}>{mainStatusText}</p>
        <div className="v3-stack client-dashboard-main__ctaInner">
          <Link className="v3-btn" href={mainButtonHref}>
            {mainButtonLabel}
          </Link>
        </div>
      </section>

      {policy?.annualMembershipVisible ? (
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
                  <Link className="v3-btn" href="/client/settings">
                    연회원 안내
                  </Link>
                  <Link className="v3-btn" href="/client/settings">
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
                <Link className="v3-btn" href="/client/settings">
                  연회원 안내 보기
                </Link>
              </div>
            </>
          )}
        </AdminSurface>
      ) : null}

      {/* 3. 진행중 대회 */}
      <section className="v3-stack" aria-labelledby="client-ongoing-tournaments-heading" style={{ gap: "0.5rem" }}>
        <h2 id="client-ongoing-tournaments-heading" className="v3-h2" style={{ margin: 0, fontSize: "1rem" }}>
          진행중 대회
        </h2>
        {displayTournaments.length === 0 ? (
          <p className="client-dashboard-main__tournamentEmpty">진행중 대회가 없습니다</p>
        ) : (
          <ul className="v3-stack client-dashboard-main__tournamentList" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {displayTournaments.map((t) => (
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
      </section>

      {/* 4. 주요 기능 */}
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

      {/* 5. 부가기능 (접기/펼치기 자리) */}
      <section aria-label="부가기능">
        <details className="client-dashboard-main__dsCard client-dashboard-main__extras">
          <summary>부가기능 (접기/펼치기 자리)</summary>
          <div className="client-dashboard-main__extrasList">
            <div className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">문의 (오류제보 / 기능건의) (자리)</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                ›
              </span>
            </div>
            <div className="client-dashboard-main__extrasRow">
              <span className="client-dashboard-main__extrasRowLabel">빈 대진표 (자리)</span>
              <span className="client-dashboard-main__extrasRowChevron" aria-hidden>
                ›
              </span>
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}
