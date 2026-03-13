"use client";

import { useState } from "react";
import Link from "next/link";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import FormField from "@/components/admin/_components/FormField";
import NotificationBar from "@/components/admin/_components/NotificationBar";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, platformAdminOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      window.location.href = "/admin/dashboard";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen flex-col bg-gray-50 p-4 dark:bg-slate-800">
      <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm">
        <CardBox className="relative z-10">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">캐롬클럽 관리자 로그인</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">CAROM.CLUB 플랫폼 관리자 전용</p>
          </div>
          <form onSubmit={handleSubmit}>
            {error && (
              <NotificationBar color="danger">{error}</NotificationBar>
            )}
            <FormField label="아이디" labelFor="admin-username">
              {({ className }) => (
                <input
                  id="admin-username"
                  type="text"
                  required
                  autoComplete="username"
                  className={className}
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="비밀번호" labelFor="admin-password">
              {({ className }) => (
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={className}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </FormField>
            <Button
              type="submit"
              label={loading ? "로그인 중..." : "로그인"}
              color="info"
              className="w-full justify-center"
              disabled={loading}
            />
          </form>
        </CardBox>
        <p className="mt-4 text-center text-xs text-gray-500 dark:text-slate-400">
          관리자 계정이 없다면 터미널에서 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npx prisma db seed</code> 를 실행하세요.
        </p>
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
            ← 사이트로 돌아가기
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
