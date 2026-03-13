"use client";

import { useRouter } from "next/navigation";
import { hasAnyDrafts, clearAllDrafts } from "@/lib/admin-drafts";

export function AdminLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
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
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
    >
      로그아웃
    </button>
  );
}
