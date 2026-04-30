export type DashboardArea = "client" | "platform";

function normPath(pathname: string): string {
  const p = pathname.split("?")[0] ?? "";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p || "/";
}

function clientTournamentBase(path: string): string | null {
  const m = /^\/client\/tournaments\/([^/]+)/.exec(path);
  return m ? `/client/tournaments/${m[1]}` : null;
}

/** 모바일 공통 헤더: 제목 + 뒤로(상위) — 공개 사이트 standard 바와 동일 색·safe-area 규칙 재사용 */
export function dashboardMobileChromeMeta(
  pathname: string,
  area: DashboardArea,
): { title: string; backHref: string | null } {
  const p = normPath(pathname);
  const root = area === "client" ? "/client" : "/platform";

  if (area === "client") {
    if (p === "/client") return { title: "대시보드", backHref: null };
    if (p === "/client/tournaments") return { title: "대회관리", backHref: "/client" };
    if (p === "/client/tournaments/new") return { title: "대회 만들기", backHref: "/client/tournaments" };
    if (p === "/client/settlement") return { title: "정산관리", backHref: "/client" };
    if (p === "/client/settlements") return { title: "전체정산 (구)", backHref: "/client" };
    if (p === "/client/member") return { title: "회원관리", backHref: "/client" };
    if (p === "/client/settings") return { title: "설정", backHref: "/client" };
    if (p === "/client/settings/blank-bracket-print") return { title: "빈 대진표 출력", backHref: "/client/settings" };
    if (p === "/client/settings/inquiries") return { title: "문의", backHref: "/client/settings" };
    if (p === "/client/settings/inquiries/new") return { title: "문의 작성", backHref: "/client/settings/inquiries" };
    if (p.startsWith("/client/settings/inquiries/")) {
      return { title: "문의 상세", backHref: "/client/settings/inquiries" };
    }
    if (p === "/client/setup") return { title: "당구장 설정", backHref: "/client" };
    if (p === "/client/setup/venue-intro") return { title: "당구장 소개", backHref: "/client/setup" };
    if (p === "/client/venues") return { title: "당구장 카드 발행", backHref: "/client" };
    if (p === "/client/tournament") return { title: "대회", backHref: "/client" };
    if (/^\/client\/settlement\/[^/]+$/.test(p)) return { title: "정산 장부", backHref: "/client/settlement" };
    const tbase = clientTournamentBase(p);
    if (tbase && p === tbase) return { title: "대회", backHref: "/client/tournaments" };
    if (tbase && p.startsWith(`${tbase}/`)) {
      if (p.includes("/bracket/auto")) return { title: "자동 대진표", backHref: tbase };
      if (p.includes("/bracket/manual")) return { title: "수동 대진표", backHref: tbase };
      if (p.includes("/bracket/preview")) return { title: "대진표 미리보기", backHref: tbase };
      if (p.includes("/bracket")) return { title: "대진표", backHref: tbase };
      if (p.includes("/participants/") && p !== `${tbase}/participants`) {
        return { title: "참가자", backHref: `${tbase}/participants` };
      }
      if (p.endsWith("/participants")) return { title: "참가자", backHref: tbase };
      if (p.includes("/outline")) return { title: "개요", backHref: tbase };
      if (p.includes("/card-publish-v2")) return { title: "게시카드 작성", backHref: tbase };
      if (p.includes("/card-publish")) return { title: "카드 발행", backHref: tbase };
      if (p.includes("/settlement/details")) return { title: "정산 상세", backHref: `${tbase}/settlement` };
      if (p.endsWith("/settlement")) return { title: "대회 정산", backHref: "/client/settlement" };
      return { title: "대회", backHref: tbase };
    }
    if (/^\/client\/venues\/[^/]+\/card-publish/.test(p)) return { title: "게시카드 작성", backHref: "/client/venues" };
    return { title: "클라이언트", backHref: root };
  }

  if (p === "/platform") return { title: "플랫폼 홈", backHref: null };
  if (p === "/platform/operations") return { title: "운영 관리", backHref: "/platform" };
  if (p === "/platform/site") return { title: "사이트 관리", backHref: "/platform" };
  if (p === "/platform/data") return { title: "데이터 관리", backHref: "/platform" };
  if (p === "/platform/data/deleted") return { title: "삭제된 항목 (백업함)", backHref: "/platform/data" };
  if (p === "/platform/tournaments") return { title: "대회 관리", backHref: "/platform" };
  if (/^\/platform\/tournaments\/[^/]+\/cards$/.test(p)) {
    const m = /^\/platform\/tournaments\/([^/]+)\/cards$/.exec(p);
    return { title: "게시 카드 관리", backHref: m ? `/platform/tournaments/${m[1]}` : "/platform/tournaments" };
  }
  if (/^\/platform\/tournaments\/[^/]+$/.test(p)) {
    return { title: "대회 상세", backHref: "/platform/tournaments" };
  }
  if (p === "/platform/main-slide-ads") return { title: "슬라이드 광고", backHref: "/platform" };
  if (p === "/platform/operations/clients") return { title: "클라이언트", backHref: "/platform/operations" };
  if (p === "/platform/operations/clients/list") {
    return { title: "클라이언트 목록", backHref: "/platform/operations/clients" };
  }
  if (p.startsWith("/platform/operations/clients/")) {
    return { title: "클라이언트 상세", backHref: "/platform/operations/clients/list" };
  }
  if (p.startsWith("/platform/operations/users")) return { title: "사용자", backHref: "/platform/operations" };
  if (p.startsWith("/platform/operations/support")) return { title: "지원", backHref: "/platform/operations" };
  if (p.startsWith("/platform/operations/settlement")) return { title: "정산", backHref: "/platform/operations" };
  if (p.startsWith("/platform/operations/membership")) return { title: "연회원", backHref: "/platform/operations" };
  if (p.startsWith("/platform/operations/push")) return { title: "푸시", backHref: "/platform/operations" };
  if (p.startsWith("/platform/site/pages")) return { title: "페이지", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/page-builder-new")) return { title: "페이지 빌더", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/page-builder-v2")) return { title: "페이지 빌더", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/page-builder")) return { title: "페이지 빌더", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/layout")) return { title: "헤더/푸터 관리", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/design")) return { title: "디자인", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/content")) return { title: "콘텐츠", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/copy")) return { title: "카피", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/notice")) return { title: "공지", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/community-posts")) return { title: "게시글 관리", backHref: "/platform/site" };
  if (p.startsWith("/platform/site/community")) return { title: "커뮤니티 설정", backHref: "/platform/site" };
  return { title: "플랫폼", backHref: root };
}
