import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import AdminCard, { AdminCardGrid, AdminSurface } from "../components/admin/AdminCard";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import { getClientDashboardPolicy } from "../../lib/surface-read";

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
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "1.15rem" }}>
      <div className="v3-row ui-client-dashboard-header" style={{ justifyContent: "space-between" }}>
        <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
          대시보드
        </h1>
        <LogoutButton redirectTo="/" />
      </div>

      {policy?.annualMembershipVisible ? (
        <AdminSurface className="v3-stack" style={{ gap: "0.65rem" }}>
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
        </AdminSurface>
      ) : null}

      <section className="v3-stack" aria-label="메뉴" style={{ gap: "0.5rem" }}>
        <AdminCardGrid>
          <AdminCard
            href="/client/tournaments"
            title="대회관리"
            description="대회 생성 · 목록 · 참가자 · 대진표"
          />
          <AdminCard href="/client/settlement" title="정산관리" description="전체정산 · 대회별 정산" />
          <AdminCard href="/client/member" title="회원관리" description="회원 목록 · 푸시 발송" />
          <AdminCard
            href="/client/settings"
            title="부가기능"
            description="업체설정 · 당구장 소개 · 문의 내역 · 빈 대진표 출력"
          />
        </AdminCardGrid>
      </section>
    </main>
  );
}
