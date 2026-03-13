"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const MOBILE_MAX = 1023;

export default function PageSectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  if (!mounted) return <>{children}</>;
  if (isMobile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-medium text-site-text">
          페이지 섹션 관리는 PC에서만 이용 가능합니다.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          PC 또는 태블릿 가로 모드에서 접속해 주세요.
        </p>
        <Link
          href="/admin"
          className="mt-6 rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          관리자 대시보드로
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
