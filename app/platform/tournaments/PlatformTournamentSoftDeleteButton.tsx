"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CONFIRM =
  "삭제하면 백업함으로 이동하며 복구할 수 있습니다.";

export default function PlatformTournamentSoftDeleteButton({
  tournamentId,
  disabled,
}: {
  tournamentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(CONFIRM)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) return;
      router.push("/platform/tournaments");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="v3-btn" type="button" disabled={disabled || busy} onClick={() => void onClick()}>
      {busy ? "처리 중…" : "대회 삭제(백업함 이동)"}
    </button>
  );
}
