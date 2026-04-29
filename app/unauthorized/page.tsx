import Link from "next/link";
import { AdminSurface } from "../components/admin/AdminCard";

type Props = {
  searchParams?: Promise<{ reason?: string; from?: string }>;
};

export default async function UnauthorizedPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const appPlatformOnly = sp.reason === "app_platform_web_only";

  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "32rem", margin: "0 auto", gap: "1.15rem" }}>
      <h1 className="v3-h1" style={{ marginBottom: "0.25rem" }}>
        접근 권한이 없습니다
      </h1>

      <AdminSurface variant="notice" className="v3-stack" style={{ gap: "0.75rem" }}>
        {appPlatformOnly ? (
          <p className="v3-muted" style={{ margin: 0, lineHeight: 1.55 }}>
            플랫폼 관리 화면은 앱(WebView) 환이 아니라 PC 웹 브라우저에서만 이용할 수 있습니다.
          </p>
        ) : (
          <>
            <p className="v3-muted" style={{ margin: 0, lineHeight: 1.55 }}>
              현재 계정 권한으로는 요청한 영역에 접근할 수 없습니다.
            </p>
            <p className="v3-muted" style={{ margin: 0, lineHeight: 1.55 }}>
              필요한 권한이 있는 계정으로 다시 로그인해 주세요.
            </p>
            <div style={{ marginTop: "0.1rem" }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem", color: "#334155" }}>필요한 권한</p>
              <ul className="v3-muted" style={{ margin: "0.4rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.55 }}>
                <li>/client: CLIENT</li>
                <li>/platform: PLATFORM</li>
              </ul>
            </div>
          </>
        )}
      </AdminSurface>

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
        {appPlatformOnly ? (
          <Link className="v3-btn" href="/site">
            공개 사이트로
          </Link>
        ) : (
          <Link className="v3-btn" href="/login">
            로그인으로
          </Link>
        )}
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
