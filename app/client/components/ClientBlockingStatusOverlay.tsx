"use client";

import styles from "./ClientBlockingStatusOverlay.module.css";

type ClientBlockingStatusOverlayProps = {
  open: boolean;
  message: string;
  /** full: 대회 생성 후 이동 등 — compact: 에디터 위 가벼운 안내 */
  variant?: "full" | "compact";
};

export function ClientBlockingStatusOverlay({
  open,
  message,
  variant = "full",
}: ClientBlockingStatusOverlayProps) {
  if (!open) return null;
  const backdropClass = variant === "compact" ? styles.backdropCompact : styles.backdropFull;
  return (
    <div className={backdropClass} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.panel}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.msg}>{message}</p>
      </div>
    </div>
  );
}
