import type { ReactNode } from "react";
import SiteShellFrame from "./SiteShellFrame";

function SkeletonBlock({
  width = "100%",
  height = "1rem",
  radius = "999px",
  background = "#dbe3ea",
}: {
  width?: string;
  height?: string;
  radius?: string;
  background?: string;
}) {
  return <div aria-hidden style={{ width, height, borderRadius: radius, background }} />;
}

export default function SiteListPageSkeleton({
  brandTitle,
  auxiliaryLabel = "불러오는 중",
  listRows = 4,
  /** 상위에 이미 `SiteShellFrame`(헤더·탭·검색)이 있을 때만 사용 — 중복 상단/헤더 방지 */
  contentOnly = false,
}: {
  brandTitle: ReactNode;
  auxiliaryLabel?: string;
  listRows?: number;
  contentOnly?: boolean;
}) {
  /** 커뮤니티 목록 전용: `CommunityBoardPostList`와 동일 ul/row 클래스 — 카드형 스켈레톤 미사용 */
  const communityListRowCount = Math.min(8, Math.max(5, listRows));
  const communityListSection = (
    <section className="site-site-gray-main v3-stack ui-community-page" aria-hidden>
      <ul className="ui-community-board-rows">
        {Array.from({ length: communityListRowCount }, (_, i) => (
          <li key={`site-comm-skel-${i}`} className="ui-community-board-row">
            <div className="ui-community-board-row-link" aria-hidden tabIndex={-1}>
              <div className="ui-community-board-row-body">
                <div className="ui-community-board-line1">
                  <SkeletonBlock width="2.5rem" height="1.05rem" radius="999px" background="#e5ebf1" />
                  <SkeletonBlock width="72%" height="1.05rem" radius="0.35rem" background="#e5ebf1" />
                </div>
                <SkeletonBlock width="58%" height="0.85rem" radius="0.25rem" background="#edf1f5" />
              </div>
              <div className="ui-community-board-thumb-wrap" aria-hidden>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "4px",
                    background: "#edf1f5",
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const listSection = (
    <section className="site-site-gray-main v3-stack" aria-hidden>
      {Array.from({ length: listRows }, (_, i) => (
        <div key={`site-skel-${i}`} className="card-clean v3-stack" style={{ gap: "0.75rem", background: "#fff" }}>
          <SkeletonBlock width="5rem" height="1rem" background="#e5ebf1" />
          <SkeletonBlock width="75%" height="1.2rem" background="#e5ebf1" />
          <SkeletonBlock width="92%" height="0.9rem" background="#edf1f5" />
          <SkeletonBlock width="62%" height="0.9rem" background="#edf1f5" />
        </div>
      ))}
    </section>
  );

  if (contentOnly) {
    return communityListSection;
  }

  return (
    <SiteShellFrame
      brandTitle={brandTitle}
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="v3-stack" style={{ gap: "0.5rem" }} aria-label={auxiliaryLabel}>
          <SkeletonBlock width="6.25rem" height="1rem" background="#dbe3ea" />
          <SkeletonBlock width="100%" height="2.75rem" radius="0.75rem" background="#edf1f5" />
        </div>
      }
    >
      {listSection}
    </SiteShellFrame>
  );
}
