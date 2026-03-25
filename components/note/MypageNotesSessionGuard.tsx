"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

type SessionPayload = { user: unknown };

/**
 * 모바일: 클라이언트 네비·bfcache 등으로 미들웨어/SSR과 어긋날 때 난구노트 본문 노출을 막기 위한 재검증.
 * 서버에서 세션이 있다고 판단된 경우에만 마운트됨(initialShow=true).
 */
export function MypageNotesSessionGuard({
  children,
  initialShow = true,
}: {
  children: React.ReactNode;
  /** 서버 getSession() 성공 시 true — 로그인 사용자는 바로 본문 표시 */
  initialShow?: boolean;
}) {
  const pathname = usePathname() ?? "/mypage/notes";
  const [show, setShow] = useState(initialShow);

  const verifySession = useCallback(() => {
    fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then((r) => r.json() as Promise<SessionPayload>)
      .then((data) => {
        if (!data.user) {
          window.location.replace(
            `/login?next=${encodeURIComponent(pathname)}`
          );
          return;
        }
        setShow(true);
      })
      .catch(() => {
        window.location.replace(
          `/login?next=${encodeURIComponent(pathname)}`
        );
      });
  }, [pathname]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  /** iOS Safari 등: 뒤로가기 복원 시 이전(로그인) 화면이 그대로 나오는 경우 방지 */
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        verifySession();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [verifySession]);

  if (!show) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-500 dark:text-slate-400 px-4">
        불러오는 중…
      </div>
    );
  }

  return <>{children}</>;
}
