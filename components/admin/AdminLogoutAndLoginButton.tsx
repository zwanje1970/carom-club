"use client";

import { useState } from "react";

/**
 * 로그아웃 후 /admin/login 으로 이동하는 버튼 (권한 없음 화면 등에서 사용)
 */
export function AdminLogoutAndLoginButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? "로그아웃 중..." : children}
    </button>
  );
}
