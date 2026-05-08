"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 승인된 /client 모바일 전용 하단 고정 바 — 레이아웃에서만 마운트(PC는 CSS로 비표시).
 */
export default function ClientMobileBottomNav() {
  const router = useRouter();

  return (
    <nav className="client-mobile-bottom-nav" aria-label="클라이언트 하단 메뉴">
      <Link href="/site" className="client-mobile-bottom-nav__btn" prefetch={false} aria-label="사이트 홈">
        <span className="client-mobile-bottom-nav__label">사이트 홈</span>
      </Link>
      <Link
        href="/client"
        className="client-mobile-bottom-nav__btn client-mobile-bottom-nav__btn--primary"
        prefetch={false}
        aria-label="클라이언트 메인"
      >
        <span className="client-mobile-bottom-nav__label">클라이언트 메인</span>
      </Link>
      <button type="button" className="client-mobile-bottom-nav__btn" aria-label="이전 페이지" onClick={() => router.back()}>
        <span className="client-mobile-bottom-nav__label">이전 페이지</span>
      </button>
    </nav>
  );
}
