"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function AvgProofUpload() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/mypage/avg-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "업로드에 실패했습니다.");
        return;
      }
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={loading}
        className="block text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
      />
      {loading && <p className="text-sm text-gray-500 mt-1">업로드 중...</p>}
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        업로드 시 만료일이 1년으로 설정됩니다.
      </p>
    </div>
  );
}
