"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_MESSAGE = `정말 회원탈퇴 하시겠습니까?
탈퇴 후 계정은 복구할 수 없습니다.`;

export function WithdrawAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleWithdraw() {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "탈퇴 처리에 실패했습니다.");
        return;
      }
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/");
      router.refresh();
    } catch {
      alert("탈퇴 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleWithdraw}
      disabled={loading}
      className="mt-4 text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {loading ? "처리 중..." : "회원탈퇴"}
    </button>
  );
}
