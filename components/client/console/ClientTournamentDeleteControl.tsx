"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * 클라이언트 대시보드 — 대회 삭제 (확인 모달 후 DELETE /api/client/tournaments/[id])
 */
export function ClientTournamentDeleteControl({
  tournamentId,
  tournamentName,
  variant,
}: {
  tournamentId: string;
  tournamentName: string;
  variant: "list-table" | "list-card" | "detail";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "삭제에 실패했습니다.");
        setBusy(false);
        return;
      }
      setOpen(false);
      if (variant === "detail") {
        router.push("/client/tournaments");
      } else {
        router.refresh();
      }
    } catch {
      setError("삭제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [tournamentId, variant, router]);

  const label = tournamentName.trim() ? `「${tournamentName.trim()}」` : "이 대회";

  const buttonClass =
    variant === "list-table"
      ? "text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
      : variant === "list-card"
        ? "text-[11px] font-semibold text-red-700 hover:underline dark:text-red-400"
        : "inline-flex min-h-[36px] items-center rounded-md border border-red-300 bg-white px-2.5 text-[11px] font-semibold text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950/40";

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)} disabled={busy}>
        삭제
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="닫기"
            disabled={busy}
            onClick={() => {
              if (!busy) setOpen(false);
            }}
          />
          <div
            className="relative w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tournament-delete-title"
          >
            <p id="tournament-delete-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              이 대회를 삭제하시겠습니까?
            </p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">삭제 후 복구할 수 없습니다.</p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">{label}</p>
            {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center rounded-md border border-red-700 bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 dark:border-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={() => void handleDelete()}
                disabled={busy}
              >
                {busy ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
