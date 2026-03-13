"use client";

import { useState } from "react";
import Link from "next/link";

export default function FindUsernamePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUsername(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/find-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "조회에 실패했습니다.");
        return;
      }
      setUsername(data.username);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
      <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-6">
        <h1 className="text-xl font-bold text-center mb-2">아이디 찾기</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          가입 시 등록한 이메일을 입력하세요.
        </p>
        {username === null ? (
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
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-site-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "확인 중..." : "아이디 찾기"}
            </button>
          </form>
        ) : (
          <div className="rounded-lg border border-site-border bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">등록된 아이디</p>
            <p className="text-lg font-semibold text-site-text">{username}</p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              로그인
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
