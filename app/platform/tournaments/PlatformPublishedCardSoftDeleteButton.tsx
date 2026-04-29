"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CONFIRM =
  "삭제하면 백업함으로 이동하며 복구할 수 있습니다.";

export default function PlatformPublishedCardSoftDeleteButton({
  tournamentId,
  snapshotId,
}: {
  tournamentId: string;
  snapshotId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(CONFIRM)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/tournaments/${encodeURIComponent(tournamentId)}/published-cards/${encodeURIComponent(snapshotId)}`,
        { method: "DELETE", cache: "no-store" },
      );
      if (!res.ok) return;
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="v3-btn" type="button" disabled={busy} onClick={() => void onClick()}>
      {busy ? "처리 중…" : "게시 카드 삭제(백업함 이동)"}
    </button>
  );
}
