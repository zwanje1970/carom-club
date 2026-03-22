"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toHalfwidth } from "@/lib/input-normalize";
import { safeInternalNextPath } from "@/lib/safe-internal-path";

const REMEMBER_ID_KEY = "carom_remember_username";
const REMEMBER_ID_CHECKED_KEY = "carom_remember_username_checked";

const NOTES_NEXT_PREFIX = "/mypage/notes";
/** 난구해결사·난구해결 게시판 — 로그인 후 원래 페이지로 (클라이언트 기본 이동보다 우선) */
const TROUBLE_NANGU_NEXT_PREFIXES = ["/community/nangu", "/community/trouble"] as const;

function readNextFromBrowser(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  return safeInternalNextPath(sp.get("next") ?? sp.get("returnUrl"));
}

function LoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? searchParams.get("returnUrl");
  const requestedNext = safeInternalNextPath(rawNext);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUsername, setRememberUsername] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [clientMode, setClientMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const checked = localStorage.getItem(REMEMBER_ID_CHECKED_KEY) === "1";
      setRememberUsername(checked);
      if (checked) {
        const saved = localStorage.getItem(REMEMBER_ID_KEY);
        if (saved) setUsername(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const signupHref =
    requestedNext != null
      ? `/signup?next=${encodeURIComponent(requestedNext)}`
      : "/signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          rememberMe,
          isClientLogin: clientMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }
      try {
        if (rememberUsername) {
          localStorage.setItem(REMEMBER_ID_KEY, username);
          localStorage.setItem(REMEMBER_ID_CHECKED_KEY, "1");
        } else {
          localStorage.removeItem(REMEMBER_ID_KEY);
          localStorage.removeItem(REMEMBER_ID_CHECKED_KEY);
        }
      } catch {
        // ignore
      }
      const role = data.role as string | undefined;
      const loginMode = data.loginMode as string | undefined;
      /** 제출 시점 URL 기준(클라이언트 네비게이션·쿼리 유실 방지) */
      const nextDest = readNextFromBrowser() ?? requestedNext;
      const returnToNotes = nextDest != null && nextDest.startsWith(NOTES_NEXT_PREFIX);
      const returnToTroubleNangu =
        nextDest != null &&
        TROUBLE_NANGU_NEXT_PREFIXES.some(
          (p) => nextDest === p || nextDest.startsWith(`${p}/`)
        );

      if (role === "PLATFORM_ADMIN") {
        window.location.href = "/admin";
        return;
      }
      // 당구노트·난구해결사 등에서 온 경우: 클라이언트/권역 기본 이동보다 next 우선
      if ((returnToNotes || returnToTroubleNangu) && nextDest) {
        window.location.href = nextDest;
        return;
      }
      /** 커뮤니티 게시판 등에서 `next=/community/...` 로 온 경우, 클라이언트 로그인이어도 원래 목록으로 복귀 */
      if (loginMode === "client" && nextDest?.startsWith("/community/")) {
        window.location.href = nextDest;
        return;
      }
      if (loginMode === "client") {
        window.location.href = "/client?welcome=1";
        return;
      }
      if (role === "ZONE_MANAGER") {
        window.location.href = "/zone";
        return;
      }
      if (nextDest) {
        window.location.href = nextDest;
        return;
      }
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
      <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-6">
        <h1 className="text-2xl font-bold text-center mb-6">로그인</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              아이디
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={username}
              onChange={(e) => setUsername(toHalfwidth(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded px-3 py-2 font-input-halfwidth"
              value={password}
              onChange={(e) => setPassword(toHalfwidth(e.target.value))}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
                className="rounded border-gray-300 text-site-primary focus:ring-site-primary"
              />
              로그인정보 기억하기
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-site-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clientMode}
                onChange={(e) => setClientMode(e.target.checked)}
                className="rounded border-gray-300 text-site-primary focus:ring-site-primary"
              />
              클라이언트로 로그인 (당구장·동호회 등 운영자만 해당)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-site-primary focus:ring-site-primary"
              />
              항시
            </label>
          </div>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href={signupHref} className="text-site-primary hover:underline">
            회원가입
          </Link>
          {" · "}
          <Link href="/login/find-username" className="text-site-primary hover:underline">
            아이디 찾기
          </Link>
          {" · "}
          <Link href="/login/forgot-password" className="text-site-primary hover:underline">
            비밀번호 찾기
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4 bg-site-bg">
          <div className="w-full max-w-md bg-site-card rounded-lg shadow border border-site-border p-8 text-center text-sm text-gray-600">
            불러오는 중…
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
