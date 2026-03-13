"use client";

import { useState } from "react";

export function CancelEntryButton({
  entryId,
  onCancel,
}: {
  entryId: string;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("참가 신청을 취소하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tournaments/entry/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "취소에 실패했습니다.");
        return;
      }
      onCancel();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="text-sm px-3 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "처리 중..." : "참가 취소"}
    </button>
  );
}
