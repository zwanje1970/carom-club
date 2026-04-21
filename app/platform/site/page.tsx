import Link from "next/link";

export default function PlatformSitePage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">사이트 관리</h1>
      <p className="v3-muted">이 화면은 사이트 운영 작업으로 이동하는 허브입니다.</p>
      <p className="v3-muted">페이지 구성 편집은 아래 "페이지 빌더"로, 게시카드 관리는 "메인용 게시카드 관리"로 이동하세요.</p>
      <ul className="v3-list">
        <li>
          <Link href="/platform/site/main-cards">메인용 게시카드 관리</Link>
        </li>
        <li>
          <Link href="/platform/site/pages">페이지 빌더 (페이지 구성 편집)</Link>
        </li>
        <li>
          <Link href="/platform/site/layout">헤더/푸터 관리</Link>
        </li>
        <li>
          <Link href="/platform/site/notice">공지 관리</Link>
        </li>
        <li>
          <Link href="/platform/site/copy">문구/카피</Link>
        </li>
        <li>
          <Link href="/platform/site/community">커뮤니티 설정</Link>
        </li>
      </ul>
    </main>
  );
}
