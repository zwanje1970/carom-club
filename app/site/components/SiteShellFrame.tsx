import type { CSSProperties, ReactNode } from "react";

const mainStyle: CSSProperties = {
  width: "100%",
  minHeight: "100dvh",
  display: "flex",
  justifyContent: "center",
  boxSizing: "border-box",
};

const shellStyle: CSSProperties = {
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

export type SiteShellFrameProps = {
  brandTitle: ReactNode;
  /** 공지 / 필터 등 상단 보조 영역. 생략 시 공지 슬롯 자체를 렌더하지 않음(대회상세 등) */
  auxiliary?: ReactNode;
  /** true: 공지 박스 높이(2.75rem) 강제 없음 — 필터만 올 때(당구장안내) */
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
  const hasAuxiliarySlot = auxiliary !== undefined;
  const isHomeShell = shellVariant === "home";
  const topWhiteClass = [
    "site-home-top-white",
    isHomeShell ? "site-home-top-white--main" : "site-home-top-white--standard",
    isHomeShell && !hasAuxiliarySlot ? "site-home-top-white--no-notice" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const auxiliarySectionClass = [
    "v3-stack",
    "site-home-notice-stack",
    auxiliaryCompact ? "site-home-notice-stack--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main id={mainId} className="v3-page site-home-page" style={mainStyle}>
      {prependMain}
      <div className="site-home-shell" style={shellStyle}>
        <div className={topWhiteClass}>
          <div className="site-home-brand">
            <div className="site-mobile-page-title-block">{brandTitle}</div>
          </div>
          {hasAuxiliarySlot ? (
            <section className={auxiliarySectionClass}>
              {auxiliary}
            </section>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  );
}
