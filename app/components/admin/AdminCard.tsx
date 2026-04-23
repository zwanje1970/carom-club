import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./admin-card.module.css";

export type AdminCardBadgeVariant = "neutral" | "emphasis";

export type AdminCardProps = {
  href: string;
  title: string;
  description: string;
  /** 미지정 시 기본 라인 아이콘 */
  icon?: ReactNode;
  /** 예: "신청 12건", "미확인 5건" — 데이터 있을 때만 전달 */
  badge?: string;
  /** emphasis: 신청·문의 등 강조(연한 노랑). neutral: 회색 */
  badgeVariant?: AdminCardBadgeVariant;
};

function DefaultIcon() {
  return (
    <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M5 7h14M5 12h14M5 17h10"
      />
    </svg>
  );
}

/**
 * 관리·대시보드 공통 카드. 카드 전체가 링크이며 내부에 별도 버튼을 두지 않는다.
 */
export default function AdminCard({
  href,
  title,
  description,
  icon,
  badge,
  badgeVariant = "neutral",
}: AdminCardProps) {
  const badgeClass = badgeVariant === "emphasis" ? styles.badgeEmphasis : styles.badgeNeutral;

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.top}>
        <span className={styles.iconWrap}>{icon ?? <DefaultIcon />}</span>
        <div className={styles.main}>
          <div className={styles.titleLine}>
            <span className={styles.title}>{title}</span>
            <span className={styles.badgeSlot} aria-hidden={badge ? undefined : true}>
              {badge ? <span className={badgeClass}>{badge}</span> : null}
            </span>
          </div>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
    </Link>
  );
}

/** 모바일 기준 2열 그리드 — 좌우 간격은 상위 `.v3-page` 패딩과 함께 쓴다 */
export function AdminCardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export type AdminSurfaceProps = {
  children: ReactNode;
  /** notice: 접근 불가 등 경고 톤(과하지 않게) */
  variant?: "default" | "notice";
  className?: string;
  style?: CSSProperties;
};

/** 폼 단계·안내 박스 — AdminCard와 동일 radius/shadow 계열 */
export function AdminSurface({ children, variant = "default", className = "", style }: AdminSurfaceProps) {
  const cls = [styles.surface, variant === "notice" ? styles.surfaceNotice : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
