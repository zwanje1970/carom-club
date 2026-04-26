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
}: {
  brandTitle: ReactNode;
  auxiliaryLabel?: string;
  listRows?: number;
}) {
  return (
    <SiteShellFrame
      brandTitle={brandTitle}
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          <SkeletonBlock width="6.25rem" height="1rem" background="#dbe3ea" />
          <SkeletonBlock width="100%" height="2.75rem" radius="0.75rem" background="#edf1f5" />
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            {auxiliaryLabel}
          </p>
        </div>
      }
    >
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
    </SiteShellFrame>
  );
}
