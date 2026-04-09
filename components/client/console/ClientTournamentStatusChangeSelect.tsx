"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export const TOURNAMENT_STATUS_CHANGE_OPTIONS = [
  "모집중",
  "마감",
  "마감임박",
  "종료",
  "대기자모집",
] as const;

export type TournamentStatusChangeChoice = (typeof TOURNAMENT_STATUS_CHANGE_OPTIONS)[number];

function mapChoiceToOperationalStatus(
  choice: TournamentStatusChangeChoice
): "OPEN" | "CLOSED" | "FINISHED" | null {
  if (choice === "모집중") return "OPEN";
  if (choice === "마감") return "CLOSED";
  if (choice === "종료") return "FINISHED";
  return null;
}

export function ClientTournamentStatusChangeSelect({
  tournamentId,
  initialChoice,
}: {
  tournamentId: string;
  initialChoice: TournamentStatusChangeChoice;
}) {
  const router = useRouter();
  const [value, setValue] = useState<TournamentStatusChangeChoice>(initialChoice);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const onChange = (nextValue: TournamentStatusChangeChoice) => {
    setValue(nextValue);
    setError("");
    const operationalStatus = mapChoiceToOperationalStatus(nextValue);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(operationalStatus ? { status: operationalStatus } : {}),
            cardStatusText: nextValue,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error || "상태 저장 실패");
          return;
        }
        router.refresh();
      } catch {
        setError("상태 저장 실패");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TournamentStatusChangeChoice)}
        disabled={isPending}
        className="min-h-[30px] rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {TOURNAMENT_STATUS_CHANGE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {isPending ? <span className="text-[10px] text-zinc-500">저장 중...</span> : null}
      {error ? <span className="text-[10px] text-red-600 dark:text-red-300">{error}</span> : null}
    </div>
  );
}
