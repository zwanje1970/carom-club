import styles from "./site-detail-shell-body-loader.module.css";

/** 상세 shell 안 본문 — 데이터 대기 시만(짧은 원형 로더 + 문구) */
export default function SiteDetailShellBodyLoader() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden />
      <p className={styles.label}>불러오는 중</p>
    </div>
  );
}
