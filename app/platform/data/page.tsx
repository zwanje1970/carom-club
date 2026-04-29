import Link from "next/link";

export default function PlatformDataHubPage() {
  return (
    <main className="v3-page v3-stack">
      <p className="v3-muted">
        <Link href="/platform">← 플랫폼 홈</Link>
      </p>
      <h1 className="v3-h1">데이터 관리</h1>
      <p className="v3-muted">삭제된 항목(백업함)에서 복구하거나 완전 삭제합니다.</p>
      <ul className="v3-list">
        <li>
          <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
        </li>
      </ul>
    </main>
  );
}
