import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import { getClientDashboardPolicy } from "../../lib/server/dev-store";

export default async function ClientHomePage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const policy = session ? await getClientDashboardPolicy(session.userId) : null;
  const membershipLabel =
    policy?.membershipState === "ACTIVE"
      ? "연회원 이용 중"
      : policy?.membershipState === "EXPIRED"
        ? "연회원 만료"
        : "일반";

  return (
    <main className="v3-page v3-stack ui-client-dashboard">
      <div className="v3-row ui-client-dashboard-header" style={{ justifyContent: "space-between" }}>
        <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
          대시보드
        </h1>
        <LogoutButton redirectTo="/" />
      </div>

      {policy?.annualMembershipVisible ? (
        <section className="v3-box v3-stack">
          <h2 className="v3-h2">연회원 상태</h2>
          <p>현재 상태: {membershipLabel}</p>
          {policy.annualMembershipEnforced ? (
            policy.membershipState === "ACTIVE" ? (
              <p className="v3-muted">연회원 제한 모드입니다. 연회원 전용 기능을 이용할 수 있습니다.</p>
            ) : (
              <>
                <p className="v3-muted" style={{ color: "#b91c1c" }}>
                  이 기능은 연회원 전용입니다
                </p>
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
        </section>
      ) : null}

      <section className="v3-stack" aria-label="메뉴" style={{ gap: "1rem" }}>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <Link
            href="/client/tournament"
            className="v3-box v3-stack ui-client-tournament-card"
            style={{ flex: "1 1 14rem", textDecoration: "none", color: "inherit", minHeight: "6rem" }}
          >
            <h2 className="v3-h2" style={{ marginBottom: "0.25rem" }}>
              대회관리
            </h2>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              대회 생성 · 목록 · 참가자 · 대진표
            </p>
          </Link>
          <Link
            href="/client/settlement"
            className="v3-box v3-stack ui-client-tournament-card"
            style={{ flex: "1 1 14rem", textDecoration: "none", color: "inherit", minHeight: "6rem" }}
          >
            <h2 className="v3-h2" style={{ marginBottom: "0.25rem" }}>
              정산관리
            </h2>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              전체정산 · 대회별 정산
            </p>
          </Link>
          <Link
            href="/client/member"
            className="v3-box v3-stack ui-client-tournament-card"
            style={{ flex: "1 1 14rem", textDecoration: "none", color: "inherit", minHeight: "6rem" }}
          >
            <h2 className="v3-h2" style={{ marginBottom: "0.25rem" }}>
              회원관리
            </h2>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              회원 목록 · 푸시 발송
            </p>
          </Link>
          <Link
            href="/client/settings"
            className="v3-box v3-stack ui-client-tournament-card"
            style={{ flex: "1 1 14rem", textDecoration: "none", color: "inherit", minHeight: "6rem" }}
          >
            <h2 className="v3-h2" style={{ marginBottom: "0.25rem" }}>
              부가기능
            </h2>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              업체설정 · 당구장 소개 · 문의 내역 · 빈 대진표 출력
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
