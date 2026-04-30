import Link from "next/link";

export default function PlatformSitePage() {
  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">이 화면은 사이트 운영 작업으로 이동하는 허브입니다.</p>
      <p className="v3-muted">페이지 구성 편집은 아래 &quot;페이지 빌더&quot;로 이동하세요.</p>
      <ul className="v3-list">
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
        <li>
          <Link href="/platform/site/community-posts">게시글 관리 (삭제)</Link>
        </li>
        <li>
          <Link href="/platform/main-slide-ads">메인 슬라이드 광고</Link>
        </li>
        <li>
          <Link href="/platform/data">데이터 관리</Link>
        </li>
        <li>
          <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
        </li>
      </ul>
    </main>
  );
}
