"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({
  redirectTo = "/",
  className,
}: {
  redirectTo?: string;
  /** 미지정 시 기존 `.v3-btn` (클라이언트·플랫폼 대시보드와 동일) */
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.push(redirectTo);
      router.refresh();
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
