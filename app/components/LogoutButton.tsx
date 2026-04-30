"use client";

import { useState } from "react";

const LOGOUT_FAIL_MSG = "로그아웃에 실패했습니다. 다시 시도해 주세요.";

export default function LogoutButton({
  redirectTo = "/",
  className,
}: {
  redirectTo?: string;
  /** 미지정 시 기존 `.v3-btn` (클라이언트·플랫폼 대시보드와 동일) */
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        window.alert(LOGOUT_FAIL_MSG);
        return;
      }
      const verify = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      if (!verify.ok) {
        window.alert(LOGOUT_FAIL_MSG);
        return;
      }
      let data: { authenticated?: boolean } = {};
      try {
        data = (await verify.json()) as { authenticated?: boolean };
      } catch {
        window.alert(LOGOUT_FAIL_MSG);
        return;
      }
      if (data.authenticated === true) {
        window.alert(LOGOUT_FAIL_MSG);
        return;
      }
      const target = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
      window.location.href = target;
    } catch {
      window.alert(LOGOUT_FAIL_MSG);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className ?? "v3-btn"} onClick={handleLogout} disabled={loading}>
      {loading ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
