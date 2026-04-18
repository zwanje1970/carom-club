import Link from "next/link";
import LogoutButton from "../components/LogoutButton";

export default function PlatformPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">플랫폼 홈</h1>
      <p className="v3-muted">운영·사이트 관리 진입 (더미)</p>
      <div className="v3-row">
        <Link className="v3-btn" href="/platform/operations">
          운영 관리
        </Link>
        <Link className="v3-btn" href="/platform/site">
          사이트 관리
        </Link>
        <LogoutButton redirectTo="/" />
      </div>
    </main>
  );
}
