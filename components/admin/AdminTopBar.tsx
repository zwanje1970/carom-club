"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/types/auth";
import { hasAnyDrafts, clearAllDrafts } from "@/lib/admin-drafts";

export function AdminTopBar({ user }: { user: SessionUser }) {
  const router = useRouter();

  async function handleLogout() {
    if (hasAnyDrafts()) {
      const ok = window.confirm(
        "저장하지 않은 내용이 있습니다. 로그아웃하면 해당 내용은 유지되지 않습니다. 로그아웃하시겠습니까?"
      );
      if (!ok) return;
      clearAllDrafts();
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">관리자</div>
      <div className="flex items-center gap-4">
        <Link
          href="/admin/me"
          className="text-sm text-gray-700 hover:text-gray-900"
        >
          {user.name} ({user.username})
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
