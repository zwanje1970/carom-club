"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!token) {
      setError("유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "재설정에 실패했습니다.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-700">비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          로그인
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-600">유효하지 않은 링크입니다. 비밀번호 찾기에서 다시 요청해 주세요.</p>
        <Link
          href="/login/forgot-password"
          className="inline-block rounded-lg bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          비밀번호 찾기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          새 비밀번호
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          새 비밀번호 확인
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-site-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "저장 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
      <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-6">
        <h1 className="text-xl font-bold text-center mb-6">비밀번호 재설정</h1>
        <Suspense fallback={<p className="text-center text-gray-500">로딩 중...</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="text-site-primary hover:underline">
            로그인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
