import Link from "next/link";
import LogoutButton from "../components/LogoutButton";

export default function PlatformPage() {
  return (
    <main className="v3-page v3-stack platform-home">
      <h1 className="v3-h1">플랫폼 홈</h1>
      <p className="v3-muted">운영·사이트 관리로 이동합니다.</p>

      <ul className="platform-home-menu-list">
        <li>
          <Link href="/platform/operations" className="platform-home-card">
            <span className="platform-home-card-icon" aria-hidden>
              ⚙️
            </span>
            <span className="platform-home-card-body">
              <span className="platform-home-card-title">운영 관리</span>
              <span className="platform-home-card-desc">클라이언트·회원·문의·정산 등</span>
            </span>
            <span className="platform-home-card-chevron" aria-hidden>
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/platform/site" className="platform-home-card">
            <span className="platform-home-card-icon" aria-hidden>
              🌐
            </span>
            <span className="platform-home-card-body">
              <span className="platform-home-card-title">사이트 관리</span>
              <span className="platform-home-card-desc">공개 사이트 콘텐츠·레이아웃</span>
            </span>
            <span className="platform-home-card-chevron" aria-hidden>
              ›
            </span>
          </Link>
        </li>
      </ul>

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <LogoutButton redirectTo="/" />
      </div>
    </main>
  );
}
