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
  maxWidth: "430px",
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
  /** 메인 최상단에 넣을 노드(스크립트 등) */
  prependMain?: ReactNode;
  mainId?: string;
  /**
   * `home`: 메인(/) 전용 — 기존 메인 상단 밀착 규칙 유지.
   * `standard`(기본): 메인 제외 사이트 페이지 공통 여백(`globals.css` 변수).
   */
  shellVariant?: "home" | "standard";
};

/**
 * 메인(/site)과 동일한 상단 흰 바 + 보조 슬롯 + 셸 구조.
 * 대회안내·대회상세에서 동일 틀로 사용한다.
 */
export default function SiteShellFrame({
  brandTitle,
  auxiliary,
  children,
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

  return (
    <main
      id={mainId}
      className={`v3-page site-home-page ${pageSurfaceClass}`}
      style={mainStyle}
    >
      {prependMain}
      <div className="site-home-shell" style={shellStyle}>
        <div className={topWhiteClass}>
          <div className="site-home-brand">
            <div className="site-mobile-page-title-block">{brandTitle}</div>
          </div>
        </div>
        {hasControls ? (
          <div className={controlsBarClass}>
            <div className="site-shell-controls-inner v3-stack">{auxiliary}</div>
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
