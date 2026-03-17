"use client";

import Link from "next/link";
import { useState } from "react";

type SessionInfo = {
  role: string;
  loginMode: string;
  isClientAccount: boolean;
};

export function MypageActionButtons({ session }: { session: SessionInfo }) {
  const isClientAccount = session.role === "CLIENT_ADMIN";
  const isClientMode = session.loginMode === "client";
  const [switching, setSwitching] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleSwitchToClient() {
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-client", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "클라이언트 모드 전환에 실패했습니다.");
        return;
      }
      window.location.href = "/client?welcome=1";
    } catch {
      alert("클라이언트 모드 전환에 실패했습니다.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isClientAccount && !isClientMode && (
        <button
          type="button"
          onClick={handleSwitchToClient}
          disabled={switching}
          className="inline-flex items-center justify-center rounded-lg border-2 border-site-primary bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-70"
        >
          {switching ? "전환 중…" : "클라이언트 로그인"}
        </button>
      )}
      {isClientAccount && isClientMode && (
        <Link
          href="/client/dashboard"
          className="inline-flex items-center justify-center rounded-lg border-2 border-site-primary bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          클라이언트 대시보드
        </Link>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        로그아웃
      </button>
    </div>
  );
}
