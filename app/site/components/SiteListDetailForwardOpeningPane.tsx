import type { ReactNode } from "react";
import SiteDetailShellBodyLoader from "./SiteDetailShellBodyLoader";
import SiteShellFrame from "./SiteShellFrame";

type Props = {
  brandTitle: ReactNode;
  /** 상세 페이지 `section`과 동일한 표면 클래스 권장 */
  sectionClassName: string;
};

/** 목록→상세 탭 직후, 라우터 응답 전 빈 상세 슬롯(원형 로더) */
export default function SiteListDetailForwardOpeningPane({ brandTitle, sectionClassName }: Props) {
  return (
    <SiteShellFrame brandTitle={brandTitle}>
      <section className={sectionClassName}>
        <SiteDetailShellBodyLoader />
      </section>
    </SiteShellFrame>
  );
}
