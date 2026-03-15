"use client";

import { useEffect, useState } from "react";

export function ClientLoginWelcomeBanner({ show }: { show: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (show && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      const clean = url.pathname + url.search;
      window.history.replaceState(null, "", clean);
    }
  }, [show]);

  if (!show || !mounted) return null;

  return (
    <div className="rounded-lg border border-site-primary/30 bg-site-primary/10 px-4 py-3 text-sm text-site-text">
      <p className="font-medium">클라이언트 계정으로 로그인되었습니다.</p>
      <p className="mt-0.5 text-site-text-muted">프로젝트 관리는 클라이언트 대시보드를 이용하세요.</p>
    </div>
  );
}
