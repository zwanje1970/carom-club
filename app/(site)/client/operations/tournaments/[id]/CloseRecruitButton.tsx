"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloseRecruitButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCloseRecruit() {
    if (!confirm("모집을 마감하시겠습니까?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "모집 마감 처리에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onCloseRecruit}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-3 text-xs font-semibold text-white hover:bg-zinc-900 disabled:opacity-50 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
      >
        {busy ? "처리 중..." : "모집마감"}
      </button>
      {error ? <p className="text-[11px] text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
