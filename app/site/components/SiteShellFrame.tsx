import type { CSSProperties, ReactNode } from "react";

const mainStyleHome: CSSProperties = {
  width: "100%",
  minHeight: "100dvh",
  display: "flex",
  justifyContent: "center",
  boxSizing: "border-box",
};

/** standard: 바깥 main을 가로 풀폭으로 — 자식 셸을 중앙에 모으지 않음(globals에서 셸도 풀폭 처리) */
const mainStyleStandard: CSSProperties = {
  width: "100%",
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "stretch",
  boxSizing: "border-box",
};

const shellStyleHome: CSSProperties = {
  width: "100%",
  minHeight: "100dvh",
  borderRadius: "1.2rem",
  paddingTop: "0",
  paddingLeft: "0.85rem",
  paddingRight: "0.85rem",
  boxSizing: "border-box",
  position: "relative",
};

/** standard: 메인 제외 페이지 — 폭 제한·라운드 제거(globals .site-home-page--standard와 동일 목적) */
const shellStyleStandard: CSSProperties = {
  width: "100%",
  maxWidth: "none",
  minHeight: "100dvh",
  borderRadius: 0,
  paddingTop: "0",
  paddingLeft: "0",
  paddingRight: "0",
  boxSizing: "border-box",
  position: "relative",
  boxShadow: "none",
};

export type SiteShellFrameProps = {
  brandTitle: ReactNode;
  /**
   * 헤더(청색 제목 바) 바로 아래 컨트롤 영역 — 필터·정렬·탭·검색 등.
   * 본문(회색 영역) 위에 두어 제목만 헤더에 남긴다.
   */
  auxiliary?: ReactNode;
  /** 컨트롤 바 세로 패딩을 약간 줄임(당구장 필터 등) */
  auxiliaryCompact?: boolean;
  /** 상단 흰 배경 아래 본문(다크 메인 또는 회색 본문) */
  children: ReactNode;
  /**
   * `shellVariant="home"` 전용: 청 헤더(로고 줄) 직후에만 렌더(옵션).
   * PC 메인 공지 등 — 전달하지 않으면 기존과 동일.
   */
  homeBelowHeader?: ReactNode;
  /** 메인 최상단에 넣을 노드(스크립트 등) */
  prependMain?: ReactNode;
  mainId?: string;
  /**
   * `home`: 메인(/) — 상단 고정 영역(dock) + 본문 스크롤(scroll-body) 구조는 `standard`와 동일.
   * `standard`(기본): 메인 제외 사이트 페이지 공통 여백(`globals.css` 변수).
   */
  shellVariant?: "home" | "standard";
};

/**
 * 공개 사이트 공통: 상단 고정(dock) + 본문 스크롤(scroll-body).
 * home·standard 모두 동일 DOM 패턴.
 */
export default function SiteShellFrame({
  brandTitle,
  auxiliary,
  children,
  homeBelowHeader,
  prependMain,
  mainId,
  auxiliaryCompact,
  shellVariant = "standard",
}: SiteShellFrameProps) {
  const hasControls = auxiliary !== undefined;
  const isHomeShell = shellVariant === "home";
  /** `globals.css` 모바일 메인 레이아웃은 `.site-home-page--main` 기준 — `shellVariant` 값(home)과 DOM 클래스명을 맞춘다. */
  const pageSurfaceClass = isHomeShell ? "site-home-page--main" : "site-home-page--standard";
  const topWhiteClass = [
    "site-home-top-white",
    isHomeShell ? "site-home-top-white--main" : "site-home-top-white--standard",
    isHomeShell && !hasControls ? "site-home-top-white--no-notice" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const controlsBarClass = ["site-shell-controls", auxiliaryCompact ? "site-shell-controls--compact" : ""]
    .filter(Boolean)
    .join(" ");

  const mainStyle = isHomeShell ? mainStyleHome : mainStyleStandard;
  const shellStyle = isHomeShell ? shellStyleHome : shellStyleStandard;

  const headerBlock = (
    <div className={topWhiteClass}>
      <div className="site-home-brand">
        <div className="site-mobile-page-title-block">{brandTitle}</div>
      </div>
    </div>
  );

  const controlsBlock =
    hasControls ? (
      <div className={controlsBarClass}>
        <div className="site-shell-controls-inner v3-stack">{auxiliary}</div>
      </div>
    ) : null;

  const homeShellInner = (
    <div className="site-home-shell" style={shellStyle}>
      <div className="site-shell-sticky-dock">
        {headerBlock}
        {homeBelowHeader ?? null}
        {controlsBlock}
      </div>
      <div className="site-shell-scroll-body">{children}</div>
    </div>
  );

  return (
    <main
      id={mainId}
      className={`v3-page site-home-page ${pageSurfaceClass}`}
      style={mainStyle}
    >
      {prependMain}
      {isHomeShell ? (
        <div className="site-home-pc-layout">
          <div className="site-home-pc-layout__primary">{homeShellInner}</div>
          <div className="site-home-pc-layout__aside" aria-hidden="true" />
        </div>
      ) : (
        homeShellInner
      )}
    </main>
  );
}
