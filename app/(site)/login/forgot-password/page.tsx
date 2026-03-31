"use client";

import { useState } from "react";
import Link from "next/link";
import { toHalfwidth } from "@/lib/input-normalize";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [resetLink, setResetLink] = useState<string | undefined>(undefined);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    setResetLink(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "요청에 실패했습니다.");
        return;
      }
      setDone(true);
      setResetLink(data.resetLink);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
      <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-6">
        <h1 className="text-xl font-bold text-center mb-2">비밀번호 찾기</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          가입 시 등록한 이메일을 입력하면 재설정 링크를 보냅니다.
        </p>
        {!done ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
                value={email}
                onChange={(e) => setEmail(toHalfwidth(e.target.value))}
                placeholder="example@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-site-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "처리 중..." : "재설정 링크 받기"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 bg-green-50 p-4 rounded">
              {resetLink
                ? "개발 환경에서는 아래 링크로 비밀번호를 재설정할 수 있습니다. (이메일 발송이 설정되지 않은 경우)"
                : "등록된 이메일로 비밀번호 재설정 링크를 보냅니다. 이메일 발송이 설정되지 않은 경우 관리자에게 문의하세요."}
            </p>
            {resetLink && (
              <p className="text-xs break-all text-site-primary bg-gray-50 p-3 rounded">
                <a href={resetLink} className="hover:underline">
                  {resetLink}
                </a>
              </p>
            )}
            <Link
              href="/login"
              className="block text-center rounded-lg bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              로그인으로
            </Link>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="text-site-primary hover:underline">
            로그인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
